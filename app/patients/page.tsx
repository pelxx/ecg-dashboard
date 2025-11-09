"use client";
import React, { useEffect, useState, useRef, Suspense } from "react";
import { ref, onValue, set, push, get } from "firebase/database";
import { useSearchParams, useRouter } from "next/navigation";
import mqtt, { MqttClient, IPublishPacket } from "mqtt";
import { rtdb, auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

import AddPatientModal from "@/components/patients/AddPatientModal";
import EditPatientModal from "@/components/patients/EditPatientModal";
import DeleteConfirmModal from "@/components/patients/DeleteConfirmModal";
import PatientInfo from "@/components/PatientInfo";
import DeviceStatus from "@/components/DeviceStatus";
import ControlPanel from "@/components/ControlPanel";
import DataLogger from "@/components/DataLogger";
import ChartSettings from "@/components/ChartSettings"; // <-- IMPORT

const ECGChart = React.lazy(() => import("@/components/ECGChart"));

type Patient = { key: string; nama: string; umur: number; jenis_kelamin: string; createdAt?: number; };
type ECGDataPoint = { timestamp: number; value: number; };
interface AllLeadsData { [patientKey: string]: { lead1: ECGDataPoint[]; lead2: ECGDataPoint[]; lead3: ECGDataPoint[]; }; }

const MAX_POINTS_PER_CHART = 300; 

function PatientPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedKey = params.get("key");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [liveEcgData, setLiveEcgData] = useState<AllLeadsData>({});
  const [liveBPM, setLiveBPM] = useState<{ [key: string]: number }>({});
  
  const [sensitivity, setSensitivity] = useState<string>('standard');
  const [paperSpeed, setPaperSpeed] = useState<number>(10000); // 10 detik (25mm/s)

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<{ [key: string]: boolean }>({});
  const [lastDeviceActivity, setLastDeviceActivity] = useState<{ [key: string]: number }>({});

  const mqttClientRef = useRef<MqttClient | null>(null);
  const activeRecordRef = useRef<{ [key: string]: { id: string | null, startTime: number | null } }>({});
  const messageCallbackRef = useRef<((topic: string, message: Buffer, packet: IPublishPacket) => void) | null>(null);
  const dataBufferRef = useRef<AllLeadsData>({});

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);

  // Fungsi Helper (mapToPoints)
  const mapToPoints = (arr: number[], baseTimestamp: number, interval: number): ECGDataPoint[] => {
      return arr.map((val, i) => ({ 
          timestamp: baseTimestamp + (i * interval),
          value: val 
      }));
  };

  // --- Hooks (Tidak ada perubahan) ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) { setUser(currentUser); setIsAuthenticated(true); }
      else { setUser(null); setIsAuthenticated(false); router.push('/'); }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated || !rtdb) return;
    const node = ref(rtdb, "patients");
    const unsub = onValue(node, (snap) => {
      const val = snap.val() || {};
      const arr: Patient[] = Object.entries(val).map(([k, v]: [string, any]) => ({ key: k, ...v }));
      arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setPatients(arr); setLoading(false);
    }, (error) => { console.error("Firebase listener error (patients):", error); setLoading(false); });
    return () => unsub();
  }, [isAuthenticated]);

  useEffect(() => {
      messageCallbackRef.current = (topic, message, packet) => {
          const parts = topic.split('/');
          const patientId = parts[1];
          if (!patientId) return;
          const messageString = message.toString();
          if (topic.includes("/realtime")) {
              try {
                  const payload = JSON.parse(messageString);
                  const startMillis = payload.startMillis;
                  const sampleInterval = payload.sampleIntervalMs;
                  if (startMillis === undefined || sampleInterval === undefined) return;
                  setLastDeviceActivity(prev => ({ ...prev, [patientId]: Date.now() })); 
                  if (payload.bpm !== undefined) setLiveBPM(prev => ({ ...prev, [patientId]: payload.bpm }));
                  const { lead1 = [], lead2 = [], lead3 = [] } = payload;
                  if (!dataBufferRef.current[patientId]) {
                      dataBufferRef.current[patientId] = { lead1: [], lead2: [], lead3: [] };
                  }
                  dataBufferRef.current[patientId].lead1.push(...mapToPoints(lead1, startMillis, sampleInterval));
                  dataBufferRef.current[patientId].lead2.push(...mapToPoints(lead2, startMillis, sampleInterval));
                  dataBufferRef.current[patientId].lead3.push(...mapToPoints(lead3, startMillis, sampleInterval));
                  if (recordingStatus[patientId]) {
                      const currentRecord = activeRecordRef.current[patientId];
                      if (currentRecord?.id && rtdb) {
                          const recordDataRef = ref(rtdb, `ecg/records/${currentRecord.id}/data/${startMillis}`);
                          set(recordDataRef, { lead1, lead2, lead3, interval: sampleInterval })
                              .catch(err => console.error("Firebase write error:", err));
                      }
                  }
              } catch (e) { console.error("Gagal parse JSON dari /realtime:", e, messageString); }
          } else if (topic.includes("/status")) {
              const status = messageString.toLowerCase();
              if (status === 'offline') {
                  setLastDeviceActivity(prev => ({ ...prev, [patientId]: 0 }));
              } else {
                  setLastDeviceActivity(prev => ({ ...prev, [patientId]: Date.now() }));
              }
              try {
                 const payload = JSON.parse(messageString);
                 if (payload.lastSeen && rtdb) {
                      set(ref(rtdb, `devices/${patientId}/lastSeen`), payload.lastSeen);
                      setLastDeviceActivity(prev => ({ ...prev, [patientId]: payload.lastSeen }));
                 }
              } catch (e) { /* Bukan JSON, tidak masalah */ }
          }
      };
  }, [recordingStatus]); 

  useEffect(() => {
      if (!isAuthenticated || mqttClientRef.current) return;
      const brokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_URL || "wss://broker.emqx.io:8084/mqtt";
      const client: MqttClient = mqtt.connect(brokerUrl);
      mqttClientRef.current = client;
      client.on("connect", () => {
          console.log("MQTT Terhubung!");
          client.subscribe("ecg/+/realtime", { qos: 0 });
          client.subscribe("devices/+/status", { qos: 1 });
      });
      const handleMessage = (topic: string, message: Buffer, packet: IPublishPacket) => {
          if (messageCallbackRef.current) {
              messageCallbackRef.current(topic, message, packet);
          }
      };
      client.on("message", handleMessage);
      client.on('error', (err) => { console.error("MQTT Connection Error:", err); });
      return () => {
          if (client) { 
              console.log("MQTT Diputus.");
              client.off("message", handleMessage); 
              client.end(true); 
              mqttClientRef.current = null; 
          }
      };
  }, [isAuthenticated]);

  useEffect(() => {
    const UPDATE_INTERVAL_MS = 100; 
    const intervalId = setInterval(() => {
      if (Object.keys(dataBufferRef.current).length === 0) return; 
      const dataToRender = dataBufferRef.current;
      dataBufferRef.current = {};
      setLiveEcgData(prevData => {
        const newData = { ...prevData }; 
        for (const patientId in dataToRender) {
          const newPoints = dataToRender[patientId];
          const currentPoints = prevData[patientId] || { lead1: [], lead2: [], lead3: [] };
          newData[patientId] = {
            lead1: [...currentPoints.lead1, ...newPoints.lead1].slice(-MAX_POINTS_PER_CHART),
            lead2: [...currentPoints.lead2, ...newPoints.lead2].slice(-MAX_POINTS_PER_CHART),
            lead3: [...currentPoints.lead3, ...newPoints.lead3].slice(-MAX_POINTS_PER_CHART),
          };
        }
        return newData;
      });
    }, UPDATE_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, []); 

  // --- Fungsi Handler (Tidak ada perubahan) ---
  const handleRecordToggle = (deviceId: string, shouldRecord: boolean) => {
      if (!rtdb) return alert("Firebase RTDB Error.");
      setRecordingStatus(prev => ({ ...prev, [deviceId]: shouldRecord }));
      if (shouldRecord) {
          const newRecordRef = push(ref(rtdb, `ecg/records`));
          const startTime = Date.now();
          set(newRecordRef, { 
              createdAt: startTime, 
              patientId: deviceId, 
              note: `Rec Start: ${new Date(startTime).toLocaleTimeString()}` 
          });
          activeRecordRef.current[deviceId] = { id: newRecordRef.key, startTime: startTime };
      } else {
          const stoppedRecord = activeRecordRef.current[deviceId];
          activeRecordRef.current[deviceId] = { id: null, startTime: null };
          if (stoppedRecord?.id && stoppedRecord.startTime) {
              const noteRef = ref(rtdb, `ecg/records/${stoppedRecord.id}/note`);
              get(ref(rtdb, `ecg/records/${stoppedRecord.id}/createdAt`)).then(snap => {
                  const startTimeFromDB = snap.val() || stoppedRecord.startTime || Date.now();
                  set(noteRef, `Rec: ${new Date(startTimeFromDB).toLocaleTimeString()} - ${new Date().toLocaleTimeString()}`);
              });
          }
      }
  };
  const handleManualSave = async (deviceId: string) => {
      if (!rtdb) return alert("Firebase RTDB error.");
      const currentData = liveEcgData[deviceId];
      if (!currentData || currentData.lead1.length === 0) return alert("Tidak ada data live.");
      try {
          const newRecordRef = push(ref(rtdb, `ecg/records`));
          await set(newRecordRef, { createdAt: Date.now(), patientId: deviceId, note: `Manual snapshot`, data: currentData });
          alert('Snapshot berhasil disimpan!');
      } catch (error) { console.error("Gagal save snapshot:", error); alert('Gagal.'); }
  };
  const openEdit = (p: Patient) => { setCurrentPatient(p); setEditOpen(true); };
  const openDelete = (p: Patient) => { setCurrentPatient(p); setDeleteOpen(true); };

  // --- Data untuk Render & Render Logic ---
  const patientToShow = selectedKey ? patients.find(p => p.key === selectedKey) : null;
  const selectedLeads = patientToShow ? liveEcgData[patientToShow.key] : null;

  if (isAuthLoading || (isAuthenticated && loading && !selectedKey && patients.length === 0)) {
      return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>;
  }
  if (!user) return null;

  // Render Halaman Detail Pasien
  if (selectedKey && patientToShow) {
    return (
        <main className="min-h-screen bg-black text-white p-6">
            <header className="max-w-6xl mx-auto mb-6 flex justify-between items-center">
                {/* Judul BIRU */}
                <h1 className="text-3xl font-bold text-blue-300">Detail Pasien</h1>
                <button onClick={() => router.push("/patients")} className="px-3 py-1 rounded bg-gray-700 text-white hover:bg-gray-600">← Kembali</button>
            </header>
            <section className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
                
                {/* Kolom Kiri (BIRU) */}
                <div className="w-full lg:w-1/3 flex flex-col gap-6">
                    <PatientInfo id={patientToShow.key} name={patientToShow.nama} age={patientToShow.umur} gender={patientToShow.jenis_kelamin} bpm={liveBPM[patientToShow.key] || 0} />
                    
                    {/* Card Setting Baru (Judul BIRU) */}
                    <ChartSettings 
                      currentSpeed={paperSpeed}
                      onSpeedChange={setPaperSpeed}
                      currentSensitivity={sensitivity}
                      onSensitivityChange={setSensitivity}
                    />

                    <DeviceStatus
                      deviceId={patientToShow.key}
                      lastActivityTimestamp={lastDeviceActivity[patientToShow.key] || null}
                    />
                    <ControlPanel 
                      deviceId={patientToShow.key} 
                      onRecordToggle={handleRecordToggle} 
                      onManualSave={handleManualSave} 
                    />
                </div>
                
                {/* Kolom Kanan (HIJAU) */}
                <div className="w-full lg:w-2/3 flex flex-col gap-6">
                    {/* Card Chart (Judul HIJAU) */}
                    <div className="bg-gray-900/70 p-4 rounded-lg border border-green-700/30">
                        <div className="flex justify-between items-center mb-3">
                           <h2 className="text-xl font-semibold text-green-400">ECG Realtime (MQTT)</h2>
                        </div>
                        
                        <Suspense fallback={<div className="text-center p-8 text-gray-400">Memuat Grafik...</div>}>
                            <ECGChart title="Lead I" data={selectedLeads?.lead1 || []} yAxisSetting={sensitivity} paperSpeedMs={paperSpeed} />
                            <ECGChart title="Lead II" data={selectedLeads?.lead2 || []} yAxisSetting={sensitivity} paperSpeedMs={paperSpeed} />
                            <ECGChart title="Lead III" data={selectedLeads?.lead3 || []} yAxisSetting={sensitivity} paperSpeedMs={paperSpeed} />
                        </Suspense>
                    </div>
                    {/* Card Data Logger (Judul BIRU) */}
                    <DataLogger patientId={patientToShow.key} />
                </div>
            </section>
        </main>
    );
  }

  // Render Halaman Daftar Pasien (Tema Biru/Hijau)
  return (
    <main className="min-h-screen bg-black text-white p-6">
        <header className="max-w-6xl mx-auto mb-6 flex items-center justify-between">
            <div>
                {/* Judul BIRU */}
                <h1 className="text-3xl font-bold text-blue-300">Daftar Pasien</h1>
                <p className="text-sm text-gray-400">Klik kartu untuk melihat data ECG live dari MQTT.</p>
            </div>
            {/* Tombol HIJAU */}
            <button onClick={() => setAddOpen(true)} className="px-4 py-2 rounded bg-green-500 text-black font-semibold">+ Tambah Pasien</button>
        </header>
        <section className="max-w-6xl mx-auto">
            {loading ? <div className="text-gray-400">Memuat pasien...</div> : (
                patients.length === 0 ? <div className="text-gray-400">Belum ada pasien.</div> :
                (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {patients.map((p) => (
                        // Card list border BIRU
                        <div key={p.key} className="bg-gray-900/60 border border-blue-900/30 rounded-lg p-4 cursor-pointer hover:scale-[1.01] transition" onClick={() => router.push(`/patients?key=${p.key}`)}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">{p.nama}</h3>
                                    <p className="text-sm text-gray-400 mt-1">{p.jenis_kelamin} · {p.umur} tahun</p>
                                </div>
                                <div className="flex flex-col gap-2 ml-3">
                                    <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="px-2 py-1 rounded bg-gray-800 text-blue-200 text-sm">Edit</button>
                                    <button onClick={(e) => { e.stopPropagation(); openDelete(p); }} className="px-2 py-1 rounded bg-red-600 text-white text-sm">Hapus</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>)
            )}
        </section>
        <AddPatientModal open={addOpen} onClose={() => setAddOpen(false)} />
        {currentPatient && (
            <>
                <EditPatientModal open={editOpen} onClose={() => setEditOpen(false)} patientKey={currentPatient.key} initial={currentPatient} />
                <DeleteConfirmModal open={deleteOpen} onClose={() => setDeleteOpen(false)} patientKey={currentPatient.key} />
            </>
        )}
    </main>
  );
}

// Komponen wrapper Suspense
export default function PatientsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading Page...</div>}>
      <PatientPageContent />
    </Suspense>
  );
}