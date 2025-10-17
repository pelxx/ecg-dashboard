"use client";
import React, { useEffect, useState, useRef } from "react";
import { ref, onValue, set, push } from "firebase/database";
import { useSearchParams, useRouter } from "next/navigation";
import mqtt, { MqttClient } from "mqtt";
import { rtdb } from "@/lib/firebase";

// Import semua komponen yang relevan
import AddPatientModal from "@/components/patients/AddPatientModal";
import EditPatientModal from "@/components/patients/EditPatientModal";
import DeleteConfirmModal from "@/components/patients/DeleteConfirmModal";
import PatientInfo from "@/components/PatientInfo";
import DeviceStatus from "@/components/DeviceStatus";
import ControlPanel from "@/components/ControlPanel";
import DataLogger from "@/components/DataLogger";

// Gunakan React.lazy untuk dynamic import
const ECGChart = React.lazy(() => import("@/components/ECGChart"));

// --- Definisi Tipe Data ---
type Patient = {
  key: string;
  nama: string;
  umur: number;
  jenis_kelamin: string;
  createdAt?: number;
};

type ECGDataPoint = {
  timestamp: number;
  value: number;
};

interface AllLeadsData {
  [patientKey: string]: {
    lead1: ECGDataPoint[];
    lead2: ECGDataPoint[];
    lead3: ECGDataPoint[];
  };
}

const MAX_POINTS_PER_CHART = 500;

export default function PatientsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedKey = params.get("key");

  // --- States ---
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [liveEcgData, setLiveEcgData] = useState<AllLeadsData>({});
  const [liveBPM, setLiveBPM] = useState<{ [key: string]: number }>({});
  const [yAxisMode, setYAxisMode] = useState<'auto' | 'fixed'>('auto');
  
  const mqttClientRef = useRef<MqttClient | null>(null);
  const lastPeakTimeRef = useRef<{ [key: string]: number }>({});

  // --- States untuk Modal ---
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);

  // useEffect untuk mengambil pasien
  useEffect(() => {
    const node = ref(rtdb, "patients");
    onValue(node, (snap) => {
      const val = snap.val() || {};
      const arr: Patient[] = Object.entries(val).map(([k, v]: [string, any]) => ({ key: k, ...v }));
      arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setPatients(arr);
      setLoading(false);
    });
  }, []);

  // useEffect untuk koneksi MQTT
  useEffect(() => {
    if (mqttClientRef.current) return;
    const client: MqttClient = mqtt.connect("wss://broker.emqx.io:8084/mqtt");
    mqttClientRef.current = client;

    client.on("connect", () => {
      console.log("✅ Terhubung ke MQTT broker");
      client.subscribe("ecg/+/realtime", { qos: 0 });
      client.subscribe("devices/+/status", { qos: 0 });
    });

    client.on("message", (topic, message) => {
        const parts = topic.split('/');
        const patientId = parts[1];
        if (!patientId) return;

        try {
            if (topic.includes("/realtime")) {
                const chunk = JSON.parse(message.toString());
                const { lead1 = [], lead2 = [], lead3 = [] } = chunk;
                const timestamp = chunk.timestamp || Date.now();
                setLiveEcgData(prev => {
                    const current = prev[patientId] || { lead1: [], lead2: [], lead3: [] };
                    const mapToPoints = (arr: number[]): ECGDataPoint[] => arr.map((val, i) => ({ timestamp: timestamp + i * 4, value: val }));
                    return {
                        ...prev,
                        [patientId]: {
                            lead1: [...current.lead1, ...mapToPoints(lead1)].slice(-MAX_POINTS_PER_CHART),
                            lead2: [...current.lead2, ...mapToPoints(lead2)].slice(-MAX_POINTS_PER_CHART),
                            lead3: [...current.lead3, ...mapToPoints(lead3)].slice(-MAX_POINTS_PER_CHART),
                        },
                    };
                });
            } else if (topic.includes("/status")) {
                const statusPayload = JSON.parse(message.toString());
                if (statusPayload.lastSeen) {
                    set(ref(rtdb, `devices/${patientId}/lastSeen`), statusPayload.lastSeen);
                }
            }
        } catch (e) {}
    });
    
    return () => { if (client) client.end(true); };
  }, []);

  // useEffect untuk menghitung BPM
  useEffect(() => {
    if (!selectedKey || !liveEcgData[selectedKey]) return;

    const lead2Data = liveEcgData[selectedKey].lead2;
    if (lead2Data.length < 2) return;

    const R_PEAK_THRESHOLD = 680; 
    const MIN_INTERVAL_MS = 300;  

    const recentData = lead2Data.slice(-20); 
    
    recentData.forEach(point => {
        if (
            point.value > R_PEAK_THRESHOLD &&
            (point.timestamp - (lastPeakTimeRef.current[selectedKey] || 0)) > MIN_INTERVAL_MS
        ) {
            const lastPeak = lastPeakTimeRef.current[selectedKey];
            if (lastPeak) {
                const rr_interval = point.timestamp - lastPeak;
                const newBPM = Math.round(60000 / rr_interval);
                if (newBPM > 40 && newBPM < 200) {
                    setLiveBPM(prev => ({ ...prev, [selectedKey]: newBPM }));
                }
            }
            lastPeakTimeRef.current[selectedKey] = point.timestamp;
        }
    });
  }, [liveEcgData, selectedKey]);

  // Fungsi untuk Control Panel dan Data Logger
  const sendCommand = (deviceId: string, command: 'start' | 'stop') => {
    const topic = `ecg/${deviceId}/command`;
    const payload = JSON.stringify({ streaming: command === 'start' });
    mqttClientRef.current?.publish(topic, payload);
    set(ref(rtdb, `devices/${deviceId}/streaming`), command === 'start');
  };

  const handleManualSave = async (deviceId: string) => {
    const currentData = liveEcgData[deviceId];
    if (!currentData || currentData.lead1.length === 0) {
      alert("Tidak ada data live untuk disimpan.");
      return;
    }
    try {
      const newRecordRef = push(ref(rtdb, `ecg/records`));
      await set(newRecordRef, {
        createdAt: Date.now(),
        patientId: deviceId,
        note: `Manual save`,
        data: currentData
      });
      alert('Snapshot berhasil disimpan!');
    } catch (error) {
      console.error("Gagal menyimpan snapshot:", error);
    }
  };

  // Helper untuk modal
  const openEdit = (p: Patient) => { setCurrentPatient(p); setEditOpen(true); };
  const openDelete = (p: Patient) => { setCurrentPatient(p); setDeleteOpen(true); };

  const patientToShow = selectedKey ? patients.find(p => p.key === selectedKey) : null;
  const selectedLeads = patientToShow ? liveEcgData[patientToShow.key] : null;

  // Render halaman detail pasien
  if (selectedKey && patientToShow) {
    return (
      <main className="min-h-screen bg-black text-white p-6">
        <header className="max-w-6xl mx-auto mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-blue-300">Detail Pasien</h1>
          <button onClick={() => router.push("/patients")} className="px-3 py-1 rounded bg-gray-700 text-white hover:bg-gray-600">
            ← Kembali
          </button>
        </header>
        <section className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-1/3 flex flex-col gap-6">
            <PatientInfo 
              id={patientToShow.key} 
              name={patientToShow.nama} 
              age={patientToShow.umur} 
              gender={patientToShow.jenis_kelamin}
              bpm={liveBPM[patientToShow.key] || 0}
            />
            <DeviceStatus deviceId={patientToShow.key} />
            <ControlPanel deviceId={patientToShow.key} onCommand={sendCommand} onManualSave={handleManualSave} />
          </div>
          <div className="w-full lg:w-2/3 flex flex-col gap-6">
            <div className="bg-gray-900 p-4 rounded-lg border border-blue-800/50">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-semibold text-blue-300">ECG Realtime (MQTT)</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Skala Y:</span>
                  <button 
                    onClick={() => setYAxisMode('auto')}
                    className={`px-2 py-1 text-xs rounded ${yAxisMode === 'auto' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'}`}
                  >
                    Auto
                  </button>
                  <button 
                    onClick={() => setYAxisMode('fixed')}
                    className={`px-2 py-1 text-xs rounded ${yAxisMode === 'fixed' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'}`}
                  >
                    Fixed
                  </button>
                </div>
              </div>
              <React.Suspense fallback={<div className="text-center p-8">Memuat Grafik...</div>}>
                <ECGChart title="Lead I" data={selectedLeads?.lead1 || []} yAxisMode={yAxisMode} />
                <ECGChart title="Lead II" data={selectedLeads?.lead2 || []} yAxisMode={yAxisMode} />
                <ECGChart title="Lead III" data={selectedLeads?.lead3 || []} yAxisMode={yAxisMode} />
              </React.Suspense>
            </div>
            <DataLogger />
          </div>
        </section>
      </main>
    );
  }

  // Render halaman daftar pasien
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
        {loading ? <div className="text-gray-400">Memuat...</div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          </div>
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