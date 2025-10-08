"use client";
import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { useRouter } from "next/navigation";
import { rtdb } from "@/lib/firebase";

import AddPatientModal from "@/components/patients/AddPatientModal";
import EditPatientModal from "@/components/patients/EditPatientModal";
import DeleteConfirmModal from "@/components/patients/DeleteConfirmModal";

type Patient = {
  key: string;
  nama: string;
  umur: number;
  jenis_kelamin: string;
};

export default function PatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [currentData, setCurrentData] = useState<any>(null);

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
      // sort by createdAt if present (newest first)
      arr.sort((a: any, b: any) => (b?.createdAt || 0) - (a?.createdAt || 0));
      setPatients(arr);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openEdit = (p: Patient) => {
    setCurrentKey(p.key);
    setCurrentData({ nama: p.nama, umur: p.umur, jenis_kelamin: p.jenis_kelamin });
    setEditOpen(true);
  };

  const openDelete = (key: string) => {
    setCurrentKey(key);
    setDeleteOpen(true);
  };

  const handleCardClick = (key: string) => {
    router.push(`/patients/${key}`);
  };

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <header className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-blue-300">Daftar Pasien</h1>
            <p className="text-sm text-gray-400">Tambah, edit, atau hapus pasien. Klik kartu untuk detail.</p>
          </div>
          <div>
            <button onClick={() => setAddOpen(true)} className="px-4 py-2 rounded bg-blue-500 text-black font-semibold">
              + Tambah Pasien
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto">
        {loading ? (
          <div className="text-gray-400">Memuat...</div>
        ) : patients.length === 0 ? (
          <div className="text-gray-400">Belum ada pasien. Tambah pasien dulu.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.map((p) => (
              <div key={p.key} className="bg-gray-900/60 border border-blue-900/30 rounded-lg p-4 cursor-pointer hover:scale-[1.01] transition" onClick={() => handleCardClick(p.key)}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{p.nama}</h3>
                    <p className="text-sm text-gray-400 mt-1">{p.jenis_kelamin} · {p.umur} tahun</p>
                  </div>
                  <div className="flex flex-col gap-2 ml-3">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="px-2 py-1 rounded bg-gray-800 text-blue-200 text-sm">Edit</button>
                    <button onClick={(e) => { e.stopPropagation(); openDelete(p.key); }} className="px-2 py-1 rounded bg-red-600 text-white text-sm">Hapus</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <AddPatientModal open={addOpen} onClose={() => setAddOpen(false)} />
      <EditPatientModal open={editOpen} onClose={() => setEditOpen(false)} patientKey={currentKey || undefined} initial={currentData} />
      <DeleteConfirmModal open={deleteOpen} onClose={() => setDeleteOpen(false)} patientKey={currentKey || undefined} />
    </main>
  );
}
