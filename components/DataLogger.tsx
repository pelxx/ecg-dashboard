"use client";
import React from 'react';
// PERUBAHAN: Import 'remove' dari firebase/database
import { ref, onValue, get, remove } from "firebase/database";
import { rtdb } from "@/lib/firebase";

type RecordItem = {
    key: string;
    createdAt?: number;
    note?: string;
};
  
interface FirebaseRecordData {
    createdAt?: number;
    note?: string;
}
  
type ECGDataPoint = {
    timestamp: number;
    value: number;
};
  
interface LeadsData {
    lead1: ECGDataPoint[];
    lead2: ECGDataPoint[];
    lead3: ECGDataPoint[];
}


export default function DataLogger() {
    const [records, setRecords] = React.useState<RecordItem[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const rRef = ref(rtdb, "ecg/records");
        const unsub = onValue(rRef, (snap) => {
            const val = snap.val() || {};
            const arr = Object.entries(val).map(([k, v]) => ({
                key: k,
                ...(v as FirebaseRecordData),
            })).sort((a: RecordItem, b: RecordItem) => (b.createdAt || 0) - (a.createdAt || 0));
            setRecords(arr);
            setLoading(false);
        });
        return () => unsub();
    }, []);
    
    const downloadRecord = async (key: string) => {
        try {
            const recSnap = await get(ref(rtdb, `ecg/records/${key}/data`));
            const data: LeadsData | null = recSnap.exists() ? recSnap.val() : null;

            if (!data || !data.lead1 || data.lead1.length === 0) {
                alert("Tidak ada sample di record ini.");
                return;
            }
            
            let csvContent = "timestamp,lead1_value,lead2_value,lead3_value\n";
            
            for (let i = 0; i < data.lead1.length; i++) {
                const timestamp = data.lead1[i]?.timestamp || '';
                const val1 = data.lead1[i]?.value ?? '';
                const val2 = data.lead2[i]?.value ?? '';
                const val3 = data.lead3[i]?.value ?? '';
                
                csvContent += `${timestamp},${val1},${val2},${val3}\n`;
            }

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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

    // --- FUNGSI BARU UNTUK MENGHAPUS REKAMAN ---
    const handleDeleteRecord = async (key: string) => {
        // Tampilkan dialog konfirmasi sebelum menghapus
        if (window.confirm("Apakah Anda yakin ingin menghapus rekaman ini? Tindakan ini tidak dapat dibatalkan.")) {
            try {
                const recordRef = ref(rtdb, `ecg/records/${key}`);
                await remove(recordRef);
                // Tampilan akan otomatis diperbarui karena listener onValue
                console.log(`Rekaman ${key} berhasil dihapus.`);
            } catch (error) {
                console.error("Gagal menghapus rekaman:", error);
                alert("Gagal menghapus rekaman.");
            }
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
                                    Download
                                </button>
                                {/* --- TOMBOL HAPUS BARU --- */}
                                <button 
                                    onClick={() => handleDeleteRecord(r.key)} 
                                    className="px-3 py-1 rounded border border-red-700 text-red-300 text-sm hover:bg-red-900/30"
                                >
                                    Hapus
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

