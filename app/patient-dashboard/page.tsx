"use client";
import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import dynamic from "next/dynamic";
import PatientInfo from "@/components/PatientInfo";

// pakai dynamic import supaya Chart jalan di client-side
const ECGChart = dynamic(() => import("@/components/ECGChart"), { ssr: false });

interface ECGData {
  timestamp: number;
  lead1?: number;
  lead2?: number;
  lead3?: number;
}

interface Patient {
  key: string;
  nama: string;
  umur: number;
  jenis_kelamin: string;
}

export default function PatientDashboard() {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [ecgData, setEcgData] = useState<ECGData[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);

  // ambil daftar pasien
  useEffect(() => {
    const node = ref(rtdb, "patients");
    const unsub = onValue(node, (snap) => {
      const val = snap.val() || {};
      const arr: Patient[] = Object.entries(val).map(([k, v]: any) => ({
        key: k,
        nama: v.nama,
        umur: v.umur,
        jenis_kelamin: v.jenis_kelamin,
      }));
      setPatients(arr);
    });
    return () => unsub();
  }, []);

  // ambil data ECG realtime sesuai pasien
  useEffect(() => {
    if (!selectedPatient) return;
    const ecgRef = ref(rtdb, `ecg/${selectedPatient.key}/realtime`);
    const unsub = onValue(ecgRef, (snap) => {
      const val = snap.val();
      if (!val) return;
      const arr = Object.values(val) as ECGData[];
      setEcgData(arr.slice(-100)); // ambil 100 data terakhir
    });
    return () => unsub();
  }, [selectedPatient]);

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-3xl font-bold text-green-400 mb-6">ECG Dashboard</h1>

      <div className="flex flex-wrap gap-6">
        {/* Sidebar daftar pasien */}
        <div className="w-full md:w-1/4 bg-gray-900/60 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3 text-green-300">Daftar Pasien</h2>
          {patients.map((p) => (
            <div
              key={p.key}
              onClick={() => setSelectedPatient(p)}
              className={`p-2 rounded mb-2 cursor-pointer ${
                selectedPatient?.key === p.key ? "bg-green-800/50" : "bg-gray-800/40"
              } hover:bg-green-700/30`}
            >
              {p.nama} <span className="text-gray-400 text-sm">({p.jenis_kelamin})</span>
            </div>
          ))}
        </div>

        {/* Detail pasien & grafik */}
        <div className="flex-1 flex flex-col gap-4">
          {selectedPatient ? (
            <>
              <PatientInfo
                id={selectedPatient.key}
                name={selectedPatient.nama}
                age={selectedPatient.umur}
                gender={selectedPatient.jenis_kelamin}
              />
              <div className="bg-gray-900/60 p-4 rounded-lg">
                <h3 className="text-green-300 font-semibold mb-2">Realtime ECG</h3>
               <ECGChart
  data={ecgData.map((d, i) => ({
    time: d.timestamp ?? i,
    value: d.lead1 ?? 0,
  }))}
/>

<ECGChart
  data={ecgData.map((d, i) => ({
    time: d.timestamp ?? i,
    value: d.lead2 ?? 0,
  }))}
/>

<ECGChart
  data={ecgData.map((d, i) => ({
    time: d.timestamp ?? i,
    value: d.lead3 ?? 0,
  }))}
/>

              </div>
            </>
          ) : (
            <div className="text-gray-400">Pilih pasien dari daftar kiri untuk melihat data.</div>
          )}
        </div>
      </div>
    </main>
  );
}
