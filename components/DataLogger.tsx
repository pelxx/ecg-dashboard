"use client";
import React from 'react';
import { ref, onValue, get, remove } from "firebase/database"; // Import remove
import { rtdb } from "@/lib/firebase";

// --- Tipe Data ---
type RecordItem = {
    key: string;
    createdAt?: number;
    note?: string;
    patientId?: string;
};

interface FirebaseRecordData {
    createdAt?: number;
    note?: string;
    patientId?: string;
    data?: {
        [timestamp: string]: {
            lead1?: number[];
            lead2?: number[];
            lead3?: number[];
        }
    }
}

export default function DataLogger() {
    const [records, setRecords] = React.useState<RecordItem[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!rtdb) {
            console.error("Firebase RTDB not initialized in DataLogger");
            setLoading(false);
            return;
        }
        const rRef = ref(rtdb, "ecg/records"); // Path ke daftar rekaman

        // Simpan fungsi unsubscribe yang dikembalikan oleh onValue
        const unsubscribe = onValue(rRef, (snap) => {
            const val = snap.val() || {};
            const arr = Object.entries(val).map(([k, v]) => ({
                key: k,
                ...(v as FirebaseRecordData),
                data: undefined // Hapus data besar agar tidak disimpan di state
            })).sort((a: RecordItem, b: RecordItem) => (b.createdAt || 0) - (a.createdAt || 0));
            setRecords(arr);
            setLoading(false);
        }, (error) => { // Tambahkan error handling untuk listener
            console.error("Firebase listener error (DataLogger):", error);
            setLoading(false);
        });

        // ================= PERBAIKAN DI SINI =================
        // Fungsi cleanup sekarang memanggil fungsi unsubscribe
        return () => {
            console.log("Cleaning up DataLogger listener...");
            unsubscribe(); // Panggil fungsi unsubscribe di sini
        };
        // ================= AKHIR PERBAIKAN =================

    }, []); // Dependensi kosong agar hanya jalan sekali

    const downloadRecord = async (key: string) => {
        if (!rtdb) return alert("Firebase RTDB Error.");
        try {
            const recordDataPath = `ecg/records/${key}/data`;
            console.log("Fetching data from:", recordDataPath);

            const recSnap = await get(ref(rtdb, recordDataPath));
            const dataChunks: FirebaseRecordData['data'] | null = recSnap.exists() ? recSnap.val() : null;

            if (!dataChunks) {
                alert("Tidak ada sample di record ini.");
                console.log("Data not found at path:", recordDataPath);
                return;
            }

            let csvContent = "timestamp,lead1_value,lead2_value,lead3_value\n";
            // Urutkan timestamp (kunci objek) sebelum diproses
            const sortedTimestamps = Object.keys(dataChunks).sort((a, b) => parseInt(a) - parseInt(b));

            sortedTimestamps.forEach(ts => {
                const chunk = dataChunks[ts];
                // Pastikan chunk ada dan berisi array sebelum diakses
                const lead1 = chunk?.lead1 || [];
                const lead2 = chunk?.lead2 || [];
                const lead3 = chunk?.lead3 || [];
                const maxLength = Math.max(lead1.length, lead2.length, lead3.length);

                for (let i = 0; i < maxLength; i++) {
                    // Hitung timestamp perkiraan untuk setiap sampel individu
                    const sampleTimestamp = parseInt(ts) + i * 4; // Asumsi interval 4ms per sampel
                    const val1 = lead1[i] ?? ''; // Gunakan nullish coalescing
                    const val2 = lead2[i] ?? '';
                    const val3 = lead3[i] ?? '';
                    csvContent += `${sampleTimestamp},${val1},${val2},${val3}\n`;
                }
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ecg_record_${key}.csv`;
            a.click();
            URL.revokeObjectURL(url);

        } catch (e) {
            console.error("Error downloading record:", e);
            alert("Gagal download record. Lihat console untuk detail.");
        }
    };

    const handleDeleteRecord = async (key: string) => {
        if (!rtdb) return alert("Firebase RTDB Error.");
        // Gunakan dialog konfirmasi bawaan browser
        if (window.confirm(`Yakin ingin menghapus record ${key}?`)) {
            try {
                await remove(ref(rtdb, `ecg/records/${key}`));
                console.log(`Record ${key} deleted.`);
                // State akan otomatis update karena listener onValue
            } catch (error) {
                console.error("Error deleting record:", error);
                alert("Gagal menghapus record.");
            }
        }
    };

    return (
        <div className="bg-gray-900/70 border border-green-800/30 rounded-lg p-4 w-full">
            <h4 className="text-green-300 font-semibold mb-3">Datalogger (Riwayat Rekaman)</h4>
            {loading ? (
                <div className="text-gray-400">Loading...</div>
            ) : records.length === 0 ? (
                <div className="text-gray-400">Belum ada rekaman tersimpan di Firebase.</div>
            ) : (
                // Tambahkan pembatas tinggi dan scroll
                <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-2">
                    {records.map((r) => (
                        <div key={r.key} className="flex items-center justify-between bg-black/30 p-2 rounded">
                            {/* Optimasi tampilan agar tidak terlalu lebar */}
                            <div className="text-sm text-gray-300 flex-1 mr-2 overflow-hidden">
                                <div className="font-mono text-xs text-blue-300 truncate">ID: {r.key}</div>
                                <div className="text-xs text-gray-500">
                                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}
                                </div>
                                <div className="text-xs text-gray-400 italic truncate">{r.note || 'No note'}</div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0"> {/* Cegah tombol wrap */}
                                <button
                                    onClick={() => downloadRecord(r.key)}
                                    className="px-3 py-1 rounded border border-green-700 text-green-200 text-sm hover:bg-green-900/50"
                                >
                                    Download
                                </button>
                                <button
                                    onClick={() => handleDeleteRecord(r.key)}
                                    className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700"
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

