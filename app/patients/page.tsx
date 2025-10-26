"use client";
// Import React hooks dan Suspense
import React, { useEffect, useState, useRef, Suspense } from "react";
// Import Firebase Realtime Database
import { ref, onValue, set, push, get } from "firebase/database";
// Import hooks dari Next.js untuk routing dan parameter URL
import { useSearchParams, useRouter } from "next/navigation";
// Import library MQTT
import mqtt, { MqttClient, IPublishPacket } from "mqtt";
// Import konfigurasi Firebase dan Auth
import { rtdb, auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

// Import komponen-komponen UI
import AddPatientModal from "@/components/patients/AddPatientModal";
import EditPatientModal from "@/components/patients/EditPatientModal";
import DeleteConfirmModal from "@/components/patients/DeleteConfirmModal";
import PatientInfo from "@/components/PatientInfo";
import DeviceStatus from "@/components/DeviceStatus";
import ControlPanel from "@/components/ControlPanel";
import DataLogger from "@/components/DataLogger";

// Import komponen chart secara lazy (dinamis)
const ECGChart = React.lazy(() => import("@/components/ECGChart"));

// --- Definisi Tipe Data ---
type Patient = { key: string; nama: string; umur: number; jenis_kelamin: string; createdAt?: number; };
type ECGDataPoint = { timestamp: number; value: number; };
interface AllLeadsData { [patientKey: string]: { lead1: ECGDataPoint[]; lead2: ECGDataPoint[]; lead3: ECGDataPoint[]; }; }

const MAX_POINTS_PER_CHART = 500;

// =============================================================
// Komponen Internal: Berisi semua logika utama halaman
// =============================================================
function PatientPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedKey = params.get("key");

  // --- States ---
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [liveEcgData, setLiveEcgData] = useState<AllLeadsData>({});
  const [liveBPM, setLiveBPM] = useState<{ [key: string]: number }>({});
  const [yAxisMode, setYAxisMode] = useState<'auto' | 'fixed'>('auto');
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<{ [key: string]: boolean }>({});
  const [lastDeviceActivity, setLastDeviceActivity] = useState<{ [key: string]: number }>({});

  // --- Refs ---
  const mqttClientRef = useRef<MqttClient | null>(null);
  const activeRecordRef = useRef<{ [key: string]: { id: string | null, startTime: number | null } }>({});
  const messageCallbackRef = useRef<((topic: string, message: Buffer, packet: IPublishPacket) => void) | null>(null);

  // --- States untuk Modal ---
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);

  // --- Hooks ---

  // 1. useEffect Auth Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) { setUser(currentUser); setIsAuthenticated(true); }
      else { setUser(null); setIsAuthenticated(false); router.push('/'); }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // 2. useEffect Fetch Pasien
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

  // 3. useEffect untuk MEMPERBARUI callback ref
  useEffect(() => {
      messageCallbackRef.current = (topic, message, packet) => {
          const parts = topic.split('/');
          const patientId = parts[1];
          if (!patientId) return;
          const messageString = message.toString();
          try {
              const payload = JSON.parse(messageString);
              if (topic.includes("/realtime")) {
                  
                  const deviceTimestamp = payload.timestamp || Date.now();
                  
                  setLastDeviceActivity(prev => ({ ...prev, [patientId]: Date.now() })); // Selalu pakai waktu server untuk "last activity"
                  if (payload.bpm !== undefined) setLiveBPM(prev => ({ ...prev, [patientId]: payload.bpm }));
                  
                  const { lead1 = [], lead2 = [], lead3 = [] } = payload;
                  
                  // Logic untuk update chart (tampilan live)
                  setLiveEcgData(prev => {
                      const current = prev[patientId] || { lead1: [], lead2: [], lead3: [] };
                      // NOTE: Asumsi 'lead1' dll adalah array angka, dan 'deviceTimestamp' adalah timestamp untuk AWAL array itu.
                      // Jika 'lead1' cuma 1 angka, logic mapToPoints harus diubah.
                      const mapToPoints = (arr: number[]): ECGDataPoint[] => arr.map((val, i) => ({ 
                          timestamp: deviceTimestamp + (i * 4), // Asumsi interval 4ms (250Hz) antar data point di dalam array
                          value: val 
                      }));
                      
                      return {
                          ...prev, [patientId]: {
                              lead1: [...current.lead1, ...mapToPoints(lead1)].slice(-MAX_POINTS_PER_CHART),
                              lead2: [...current.lead2, ...mapToPoints(lead2)].slice(-MAX_POINTS_PER_CHART),
                              lead3: [...current.lead3, ...mapToPoints(lead3)].slice(-MAX_POINTS_PER_CHART),
                          }
                      };
                  });
                  
                  // ===============================================
                  // DIEDIT: Logic untuk Merekam ke Database (Kembali ke Frontend)
                  // ===============================================
                  if (recordingStatus[patientId]) {
                      const currentRecord = activeRecordRef.current[patientId];
                      // Cek apakah ada record aktif di ref lokal
                      if (currentRecord?.id && rtdb) {
                          
                          // Kita pakai timestamp dari device sebagai key
                          const recordDataRef = ref(rtdb, `ecg/records/${currentRecord.id}/data/${deviceTimestamp}`);
                          
                          // Simpan data mentah-nya
                          set(recordDataRef, { 
                              lead1: lead1, 
                              lead2: lead2, 
                              lead3: lead3 
                          })
                              .catch(err => console.error("Firebase write error:", err));
                      }
                  }
                  // ===============================================
                  // AKHIR BLOK EDIT
                  // ===============================================

              } else if (topic.includes("/status")) {
                  if (payload.lastSeen && rtdb) {
                      set(ref(rtdb, `devices/${patientId}/lastSeen`), payload.lastSeen);
                      setLastDeviceActivity(prev => ({ ...prev, [patientId]: payload.lastSeen }));
                  }
              }
          } catch (e) {
              if (topic.includes("/status") && messageString.toLowerCase() === 'offline') {
                  console.warn(`Device ${patientId} LWT 'offline'.`);
                  setLastDeviceActivity(prev => ({ ...prev, [patientId]: 0 }));
              } else {
                  console.error("Gagal parse MQTT message:", e, messageString);
              }
          }
      };
  }, [recordingStatus]); // <-- Ini penting, agar callback selalu dapat `recordingStatus` terbaru

  // 4. useEffect untuk KONEKSI MQTT
  useEffect(() => {
      if (!isAuthenticated || mqttClientRef.current) return;
      // Ambil URL broker dari environment variable
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

  // --- Fungsi Handler ---

  // ===============================================
  // DIEDIT: Fungsi ini disederhanakan (Tanpa Backend Worker)
  // ===============================================
  const handleRecordToggle = (deviceId: string, shouldRecord: boolean) => {
      if (!rtdb) return alert("Firebase RTDB Error.");
      
      // 1. Set React state (untuk ubah UI & memicu callback MQTT)
      setRecordingStatus(prev => ({ ...prev, [deviceId]: shouldRecord }));
      
      // 2. Logic untuk buat/tutup 'note' rekaman
      if (shouldRecord) {
          // START RECORDING
          const newRecordRef = push(ref(rtdb, `ecg/records`));
          const startTime = Date.now();
          set(newRecordRef, { 
              createdAt: startTime, 
              patientId: deviceId, 
              note: `Rec Start: ${new Date(startTime).toLocaleTimeString()}` 
          });
          // Simpan ID rekaman aktifnya di ref LOKAL
          activeRecordRef.current[deviceId] = { id: newRecordRef.key, startTime: startTime };

      } else {
          // STOP RECORDING
          const stoppedRecord = activeRecordRef.current[deviceId];
          // Hapus ID rekaman aktif dari ref LOKAL
          activeRecordRef.current[deviceId] = { id: null, startTime: null };
          
          // Update 'note' di rekaman yang tadi
          if (stoppedRecord?.id && stoppedRecord.startTime) {
              const noteRef = ref(rtdb, `ecg/records/${stoppedRecord.id}/note`);
              get(ref(rtdb, `ecg/records/${stoppedRecord.id}/createdAt`)).then(snap => {
                  const startTimeFromDB = snap.val() || stoppedRecord.startTime || Date.now();
                  set(noteRef, `Rec: ${new Date(startTimeFromDB).toLocaleTimeString()} - ${new Date().toLocaleTimeString()}`);
              });
          }
      }
  };
  // ===============================================
  // AKHIR BLOK EDIT
  // ===============================================

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
                <h1 className="text-3xl font-bold text-blue-300">Detail Pasien</h1>
                <button onClick={() => router.push("/patients")} className="px-3 py-1 rounded bg-gray-700 text-white hover:bg-gray-600">← Kembali</button>
            </header>
            <section className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
                <div className="w-full lg:w-1/3 flex flex-col gap-6">
                    <PatientInfo id={patientToShow.key} name={patientToShow.nama} age={patientToShow.umur} gender={patientToShow.jenis_kelamin} bpm={liveBPM[patientToShow.key] || 0} />
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
                <div className="w-full lg:w-2/3 flex flex-col gap-6">
                    <div className="bg-gray-900 p-4 rounded-lg border border-blue-800/50">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-xl font-semibold text-blue-300">ECG Realtime (MQTT)</h2>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">Skala Y:</span>
                                <button onClick={() => setYAxisMode('auto')} className={`px-2 py-1 text-xs rounded ${yAxisMode === 'auto' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'}`}>Auto</button>
                                <button onClick={() => setYAxisMode('fixed')} className={`px-2 py-1 text-xs rounded ${yAxisMode === 'fixed' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'}`}>Fixed (350-900)</button>
                            </div>
                        </div>
                        <Suspense fallback={<div className="text-center p-8 text-gray-400">Memuat Grafik...</div>}>
                            <ECGChart title="Lead I" data={selectedLeads?.lead1 || []} yAxisMode={yAxisMode} />
                            <ECGChart title="Lead II" data={selectedLeads?.lead2 || []} yAxisMode={yAxisMode} />
                            <ECGChart title="Lead III" data={selectedLeads?.lead3 || []} yAxisMode={yAxisMode} />
                        </Suspense>
                    </div>
                    <DataLogger />
                </div>
            </section>
        </main>
    );
  }

  // Render Halaman Daftar Pasien
  return (
    <main className="min-h-screen bg-black text-white p-6">
        <header className="max-w-6xl mx-auto mb-6 flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold text-blue-300">Daftar Pasien</h1>
                <p className="text-sm text-gray-400">Klik kartu untuk melihat data ECG live dari MQTT.</p>
            </div>
            <button onClick={() => setAddOpen(true)} className="px-4 py-2 rounded bg-blue-500 text-black font-semibold">+ Tambah Pasien</button>
        </header>
        <section className="max-w-6xl mx-auto">
            {loading ? <div className="text-gray-400">Memuat pasien...</div> : (
                patients.length === 0 ? <div className="text-gray-400">Belum ada pasien.</div> :
                (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {patients.map((p) => (
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
        {/* Modal-modal */}
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