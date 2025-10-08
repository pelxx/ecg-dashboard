"use client";
import React, { useState } from "react";
import { remove, ref } from "firebase/database";
import { rtdb } from "@/lib/firebase";

type Props = {
  open: boolean;
  onClose: () => void;
  patientKey?: string | null;
};

export default function DeleteConfirmModal({ open, onClose, patientKey }: Props) {
  const [loading, setLoading] = useState(false);
  if (!open || !patientKey) return null;

  const handleDelete = async () => {
    if (!patientKey) return;
    if (!confirm("Yakin ingin menghapus pasien ini?")) return;
    setLoading(true);
    try {
      await remove(ref(rtdb, `patients/${patientKey}`));
      onClose();
    } catch (e) {
      console.error(e);
      alert("Gagal menghapus");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-lg border border-blue-900/40 p-4 shadow-lg">
        <h4 className="text-lg font-semibold text-red-400 mb-2">Konfirmasi Hapus</h4>
        <p className="text-sm text-gray-300 mb-4">Tindakan ini tidak dapat dibatalkan. Lanjutkan?</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded bg-gray-800 border border-blue-800/30 text-gray-200">Batal</button>
          <button onClick={handleDelete} disabled={loading} className="px-3 py-2 rounded bg-red-600 text-white">
            {loading ? "Menghapus..." : "Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
}
