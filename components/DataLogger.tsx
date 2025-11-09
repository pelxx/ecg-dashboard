"use client";
import React, { useState, useEffect } from "react";
import { rtdb } from "@/lib/firebase";
import {
  ref,
  query,
  orderByChild,
  equalTo,
  onValue,
  off,
  get, 
  remove, 
} from "firebase/database";
// =============================================================
// 1. TAMBAHKAN IMPORT ICON
// =============================================================
import { ArrowDownTrayIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/solid'



// --- Tipe Data ---
type Record = {
  key: string;
  createdAt: number;
  note: string;
  patientId: string;
};
type RawEcgData = {
  [timestamp: string]: {
    lead1: number[];
    lead2: number[];
    lead3: number[];
    interval: number;
  };
};
type Props = {
  patientId: string;
};

export default function DataLogger({ patientId }: Props) {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null); 

  // --- useEffect (Fetch list rekaman) ---
  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      setRecords([]);
      return;
    }
    setLoading(true);
    const recordsRef = ref(rtdb, "ecg/records");
    const patientQuery = query(
      recordsRef,
      orderByChild("patientId"),
      equalTo(patientId)
    );
    const unsubscribe = onValue(
      patientQuery,
      (snapshot) => {
        const data = snapshot.val() || {};
        const loadedRecords: Record[] = [];
        for (const key in data) {
          loadedRecords.push({
            key: key,
            ...data[key],
          });
        }
        loadedRecords.sort((a, b) => b.createdAt - a.createdAt);
        setRecords(loadedRecords);
        setLoading(false);
      },
      (error) => {
        console.error("Gagal fetch data logger:", error);
        setLoading(false);
      }
    );
    return () => {
      off(patientQuery, "value", unsubscribe);
    };
  }, [patientId]);

  // --- Logic Hapus Data ---
  const handleDelete = async (recordKey: string) => {
    if (!window.confirm("Yakin mau hapus data rekaman ini selamanya?")) {
      return;
    }
    try {
      const recordRef = ref(rtdb, `ecg/records/${recordKey}`);
      await remove(recordRef);
    } catch (error) {
      console.error("Gagal hapus data:", error);
      alert("Gagal menghapus data.");
    }
  };

  // --- Logic Download CSV ---
  const handleDownload = async (record: Record) => {
    setDownloading(record.key); 
    try {
      const dataRef = ref(rtdb, `ecg/records/${record.key}/data`);
      const snapshot = await get(dataRef);
      if (!snapshot.exists()) {
        alert("Tidak ada data EKG di dalam rekaman ini.");
        setDownloading(null);
        return;
      }
      const rawData: RawEcgData = snapshot.val();
      const csvContent = convertJsonToCsv(rawData);
      const fileName = `ECG_${patientId}_${record.createdAt}.csv`;
      triggerCsvDownload(csvContent, fileName);
    } catch (error) {
      console.error("Gagal download data:", error);
      alert("Gagal download data.");
    }
    setDownloading(null); 
  };

  // --- Helper: Fungsi Konversi JSON ke CSV ---
  const convertJsonToCsv = (data: RawEcgData): string => {
    let csvRows = ["timestamp,lead1,lead2,lead3"]; 
    const sortedTimestamps = Object.keys(data).sort((a, b) => Number(a) - Number(b));
    for (const ts of sortedTimestamps) {
      const chunk = data[ts];
      const startMillis = Number(ts);
      const interval = chunk.interval || 4; 
      const len = chunk.lead1?.length || 0;
      for (let i = 0; i < len; i++) {
        const sampleTimestamp = startMillis + (i * interval);
        const val1 = chunk.lead1[i] ?? "";
        const val2 = chunk.lead2[i] ?? "";
        const val3 = chunk.lead3[i] ?? "";
        csvRows.push(`${sampleTimestamp},${val1},${val2},${val3}`);
      }
    }
    return csvRows.join("\n");
  };

  // --- Helper: Fungsi Trigger Download ---
  const triggerCsvDownload = (csvContent: string, fileName: string) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Helper untuk format jam ---
  const formatTimestamp = (millis: number) => {
    return new Date(millis).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  // --- Tampilan Render (Dengan Tombol Baru) ---
  return (
    <div className="bg-gray-900/70 p-4 rounded-lg border border-green-800/30">
      <h2 className="text-xl font-semibold text-green-300 mb-3">
        Data Rekaman Pasien
      </h2>
      <div className="max-h-60 overflow-y-auto pr-2">
        {loading && <p className="text-gray-400">Memuat rekaman...</p>}
        {!loading && records.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">
            Belum ada data rekaman untuk pasien ini.
          </p>
        )}
        {!loading && records.length > 0 && (
          <ul className="space-y-2">
            {records.map((rec) => (
              <li
                key={rec.key}
                className="bg-gray-800 p-3 rounded-md border border-gray-700"
              >
                <div className="flex justify-between items-start">
                  {/* Info Rekaman */}
                  <div>
                    <p className="font-semibold text-white">{rec.note}</p>
                    <p className="text-sm text-gray-400">
                      {formatTimestamp(rec.createdAt)}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownload(rec)}
                      disabled={downloading === rec.key}
                      className="p-2 text-sm rounded bg-green-900 text-white hover:bg-green-900 disabled:bg-gray-500"
                      aria-label="Download"
                    >
                      {downloading === rec.key ? (
                        <ArrowPathIcon className="w-5 h-5 animate-spin" />
                      ) : (
                        <ArrowDownTrayIcon className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(rec.key)}
                      disabled={downloading === rec.key}
                      className="p-2 text-sm rounded bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
                      aria-label="Hapus"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                  {/* ============================================================= */}

                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


