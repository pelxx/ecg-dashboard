"use client";
import React, { useEffect, useState } from "react";
import { ref, onValue, get } from "firebase/database";
import { rtdb } from "@/lib/firebase";

type RecordItem = {
  key: string;
  createdAt?: number;
  note?: string;
};

export default function DataLogger() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rRef = ref(rtdb, "ecg/records");
    const unsub = onValue(rRef, (snap) => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([k, v]: any) => ({
        key: k,
        createdAt: v.createdAt,
        note: v.note,
      })).sort((a:any,b:any)=> (b.createdAt || 0) - (a.createdAt || 0));
      setRecords(arr);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const downloadRecord = async (key: string) => {
    try {
      const recSnap = await get(ref(rtdb, `ecg/records/${key}/data`));
      const data = recSnap.exists() ? recSnap.val() : null;
      if (!data) {
        alert("Tidak ada sample di record ini.");
        return;
      }
      // data could be array or object
      const arr = Array.isArray(data) ? data : Object.values(data);
      const csv = arr.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ecg_record_${key}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Gagal download record");
    }
  };

  return (
    <div className="bg-gray-900/70 border border-green-800/30 rounded-lg p-4 w-full">
      <h4 className="text-green-300 font-semibold mb-3">Datalogger (Riwayat Rekaman)</h4>

      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : records.length === 0 ? (
        <div className="text-gray-400">Belum ada rekaman.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map((r) => (
            <div key={r.key} className="flex items-center justify-between bg-black/30 p-2 rounded">
              <div className="text-sm text-gray-300">
                <div>ID: <span className="text-white">{r.key}</span></div>
                <div className="text-xs text-gray-500">{r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => downloadRecord(r.key)} className="px-3 py-1 rounded border border-green-700 text-green-200 text-sm">
                  Download CSV
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
