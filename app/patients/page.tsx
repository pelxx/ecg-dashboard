"use client";
import { useEffect, useState, useRef } from "react";
import { ref, onValue, push, set } from "firebase/database";
import mqtt, { MqttClient } from "mqtt";
import { rtdb } from "@/lib/firebase";
import dynamic from "next/dynamic";
import PatientInfo from "@/components/PatientInfo";
import ControlPanel from "@/components/ControlPanel";
import DataLogger from "@/components/DataLogger";

const ECGChart = dynamic(() => import("@/components/ECGChart"), { ssr: false });

// --- Definisi Tipe Data ---
interface ECGDataPoint {
  timestamp: number;
  value: number;
}

interface Patient {
  key: string;
  nama: string;
  umur: number;
  jenis_kelamin: string;
}

// State untuk menyimpan data ECG dari semua pasien, dipisah per lead
interface AllLeadsData {
  [patientKey: string]: {
    lead1: ECGDataPoint[];
    lead2: ECGDataPoint[];
    lead3: ECGDataPoint[];
  };
}

const MAX_POINTS_PER_CHART = 500; // Batas jumlah data point di grafik untuk performa

export default function PatientDashboard() {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [liveEcgData, setLiveEcgData] = useState<AllLeadsData>({});
  const mqttClientRef = useRef<MqttClient | null>(null);

  // 1. Ambil daftar pasien dari RTDB
  useEffect(() => {
    const node = ref(rtdb, "patients");
    onValue(node, (snap) => {
      const val = snap.val() || {};
      const arr: Patient[] = Object.entries(val).map(([k, v]: any) => ({
        key: k,
        nama: v.nama,
        umur: v.umur,
        jenis_kelamin: v.jenis_kelamin,
      }));
      setPatients(arr);
    });
  }, []);

  // 2. Setup koneksi dan listener MQTT
  useEffect(() => {
    if (mqttClientRef.current) return;

    const client: MqttClient = mqtt.connect("wss://broker.emqx.io:8084/mqtt");
    mqttClientRef.current = client;

    client.on("connect", () => {
      console.log("✅ Dasbor terhubung ke MQTT broker");
      client.subscribe("ecg/+/realtime", (err) => {
        if (err) console.error("❌ Gagal subscribe:", err);
        else console.log("📡 Berhasil subscribe ke ecg/+/realtime");
      });
    });

    client.on("message", (topic: string, message: Buffer) => {
      try {
        const parts = topic.split("/");
        const patientId = parts[1];
        if (!patientId) return;

        // Payload sekarang berisi array: { lead1: [...], lead2: [...], lead3: [...] }
        const chunk = JSON.parse(message.toString());
        const { lead1 = [], lead2 = [], lead3 = [] } = chunk;
        const timestamp = chunk.timestamp || Date.now();

        setLiveEcgData(prevData => {
          const currentPatientData = prevData[patientId] || { lead1: [], lead2: [], lead3: [] };

          // Mengubah array angka menjadi array objek { timestamp, value }
          const newPoints1 = lead1.map((val: number, i: number) => ({ timestamp: timestamp + i * 4, value: val }));
          const newPoints2 = lead2.map((val: number, i: number) => ({ timestamp: timestamp + i * 4, value: val }));
          const newPoints3 = lead3.map((val: number, i: number) => ({ timestamp: timestamp + i * 4, value: val }));

          // Menggabungkan data lama dengan chunk baru dan membatasinya
          const updatedLead1 = [...currentPatientData.lead1, ...newPoints1].slice(-MAX_POINTS_PER_CHART);
          const updatedLead2 = [...currentPatientData.lead2, ...newPoints2].slice(-MAX_POINTS_PER_CHART);
          const updatedLead3 = [...currentPatientData.lead3, ...newPoints3].slice(-MAX_POINTS_PER_CHART);

          return {
            ...prevData,
            [patientId]: { lead1: updatedLead1, lead2: updatedLead2, lead3: updatedLead3 },
          };
        });

      } catch (err) {
        console.error("❌ Error menangani pesan MQTT:", err);
      }
    });

    return () => {
      if (client) client.end(true);
    };
  }, []);

  // Fungsi untuk menyimpan snapshot
  const handleManualSave = async () => {
    if (!selectedPatient) return alert("Pilih pasien.");
    const currentData = liveEcgData[selectedPatient.key];
    if (!currentData || currentData.lead1.length === 0) return alert("Tidak ada data untuk disimpan.");

    try {
      const newRecordRef = push(ref(rtdb, 'ecg/records'));
      await set(newRecordRef, {
        createdAt: Date.now(),
        patientId: selectedPatient.key,
        note: `Manual save for ${selectedPatient.nama}`,
        data: currentData // Simpan semua 3 lead
      });
      alert('Snapshot berhasil disimpan!');
    } catch (error) {
      console.error("Gagal menyimpan snapshot:", error);
    }
  };

  const selectedLeads = selectedPatient ? liveEcgData[selectedPatient.key] : null;

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-3xl font-bold text-green-400 mb-6">ECG Live Dashboard (Chunk Mode)</h1>
      <div className="flex flex-wrap gap-6">
        <div className="w-full md:w-1/4 bg-gray-900/60 p-4 rounded-lg border border-gray-700">
          <h2 className="text-lg font-semibold mb-3 text-green-300">Daftar Pasien</h2>
          {patients.map((p) => (
            <div key={p.key} onClick={() => setSelectedPatient(p)}
              className={`p-2 rounded mb-2 cursor-pointer ${selectedPatient?.key === p.key ? "bg-green-800/50" : "bg-gray-800/40"} hover:bg-green-700/30`}>
              {p.nama}
            </div>
          ))}
        </div>
        <div className="flex-1 flex flex-col gap-4">
          {selectedPatient ? (
            <>
              <div className="flex flex-wrap gap-4">
                <PatientInfo id={selectedPatient.key} name={selectedPatient.nama} age={selectedPatient.umur} gender={selectedPatient.jenis_kelamin} />
                <ControlPanel onManualSave={handleManualSave} />
              </div>
              <div className="bg-gray-900/60 p-4 rounded-lg border border-gray-700">
                <h3 className="text-green-300 font-semibold mb-2">Realtime ECG Leads</h3>
                <ECGChart data={selectedLeads ? selectedLeads.lead1.map((d, i) => ({ time: i, value: d.value })) : []} />
                <ECGChart data={selectedLeads ? selectedLeads.lead2.map((d, i) => ({ time: i, value: d.value })) : []} />
                <ECGChart data={selectedLeads ? selectedLeads.lead3.map((d, i) => ({ time: i, value: d.value })) : []} />
              </div>
              <DataLogger />
            </>
          ) : (
            <div className="text-gray-400 bg-gray-900/60 p-8 rounded-lg text-center border border-gray-700">
              Pilih pasien untuk melihat data.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}