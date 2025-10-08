"use client";
import React, { useState } from "react";
import { push, ref, set } from "firebase/database";
import { rtdb } from "@/lib/firebase";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AddPatientModal({ open, onClose }: Props) {
  const [nama, setNama] = useState("");
  const [umur, setUmur] = useState<number | "">("");
  const [gender, setGender] = useState<"Laki-laki" | "Perempuan">("Laki-laki");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const reset = () => {
    setNama("");
    setUmur("");
    setGender("Laki-laki");
  };

  const handleSave = async () => {
    if (!nama || umur === "") return alert("Isi semua field");
    setSaving(true);
    try {
      const node = ref(rtdb, "patients");
      const newRef = push(node);
      await set(newRef, {
        nama,
        umur: Number(umur),
        jenis_kelamin: gender,
        createdAt: Date.now(),
      });
      reset();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Gagal tambah pasien");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-lg border border-blue-900/40 p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-blue-200 mb-3">Tambah Pasien</h3>

        <label className="block text-sm text-gray-300 mb-1">Nama</label>
        <input
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          className="w-full mb-3 p-2 rounded bg-gray-800 text-white border border-blue-800/40"
          placeholder="Nama pasien"
        />

        <label className="block text-sm text-gray-300 mb-1">Umur</label>
        <input
          type="number"
          value={umur === "" ? "" : umur}
          onChange={(e) => setUmur(e.target.value === "" ? "" : Number(e.target.value))}
          className="w-full mb-3 p-2 rounded bg-gray-800 text-white border border-blue-800/40"
          placeholder="Umur (tahun)"
        />

        <label className="block text-sm text-gray-300 mb-2">Jenis Kelamin</label>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setGender("Laki-laki")}
            className={`px-3 py-1 rounded ${gender === "Laki-laki" ? "bg-blue-500 text-black" : "bg-gray-800 text-white border border-blue-800/30"}`}
          >
            Laki-laki
          </button>
          <button
            onClick={() => setGender("Perempuan")}
            className={`px-3 py-1 rounded ${gender === "Perempuan" ? "bg-blue-500 text-black" : "bg-gray-800 text-white border border-blue-800/30"}`}
          >
            Perempuan
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={() => { reset(); onClose(); }} className="px-4 py-2 rounded bg-gray-800 border border-blue-800/30 text-gray-200">Batal</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded bg-blue-500 text-black font-semibold">
            {saving ? "Menyimpan..." : "Tambah"}
          </button>
        </div>
      </div>
    </div>
  );
}
