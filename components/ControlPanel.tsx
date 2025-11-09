"use client";
import React, { useState, useEffect } from "react";
// Import ref dan onValue untuk membaca status recording dari Firebase
import { ref, onValue, set } from "firebase/database";
import { rtdb } from "@/lib/firebase";

type Props = {
  deviceId: string;
  // Fungsi ini dipanggil saat tombol Start/Stop Record ditekan
  onRecordToggle: (deviceId: string, shouldRecord: boolean) => void; 
  onManualSave: (deviceId: string) => void;
};

export default function ControlPanel({ deviceId, onRecordToggle, onManualSave }: Props) {
  const [processing, setProcessing] = useState(false);
  // State untuk status recording, dibaca dari Firebase
  const [isRecording, setIsRecording] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Baca status recording awal dari Firebase
  useEffect(() => {
    const recordingRef = ref(rtdb, `devices/${deviceId}/isRecording`);
    const unsubscribe = onValue(recordingRef, (snapshot) => {
      setIsRecording(!!snapshot.val()); // Konversi nilai ke boolean
      setLoadingStatus(false);
    });
    // Cleanup listener
    return () => unsubscribe();
  }, [deviceId]);

  // Handler untuk tombol Start/Stop Record
  const handleRecordToggle = async () => {
    const shouldRecordNow = !isRecording; // Aksi kebalikan dari status saat ini
    setProcessing(true);
    // 1. Panggil fungsi dari parent untuk mengubah logika penyimpanan
    onRecordToggle(deviceId, shouldRecordNow); 
    // 2. Update status di Firebase agar persisten & bisa dibaca komponen lain
    await set(ref(rtdb, `devices/${deviceId}/isRecording`), shouldRecordNow);
    // (State lokal `isRecording` akan otomatis terupdate oleh listener onValue)
    setTimeout(() => setProcessing(false), 500); 
  };
  
  // Handler untuk Save Snapshot (tidak berubah)
  const handleSave = async () => {
    setProcessing(true);
    onManualSave(deviceId);
    setTimeout(() => setProcessing(false), 1000);
  };

  // Jangan render tombol jika status awal belum dimuat
  if (loadingStatus) {
    return (
      <div className="bg-gray-900/70 border border-green-800/30 rounded-lg p-4 flex flex-col gap-3 w-full items-center justify-center h-40">
        <p className="text-gray-400 text-sm">Loading controls...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/70 border border-green-800/30 rounded-lg p-4 flex flex-col gap-3 w-full">
      <h4 className="text-green-300 font-semibold">Recording Control</h4>

      {/* Tombol Start/Stop Record (Toggle) */}
      <button 
        onClick={handleRecordToggle} 
        disabled={processing}
        // Ubah warna dan teks berdasarkan status isRecording
        className={`w-full py-2 rounded font-semibold disabled:opacity-50 ${
          isRecording 
            ? 'bg-red-600 hover:bg-red-500 text-white' // Tombol Stop
            : 'bg-green-600 hover:bg-green-500 text-white' // Tombol Start
        }`}
      >
        {isRecording ? '■ Stop Record' : '▶ Start Record'}
      </button>

      {/* Tombol Save Snapshot */}
      <button onClick={handleSave} disabled={processing || isRecording} className="py-2 rounded border border-green-700 text-green-200 hover:bg-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed">
        ⤓ Save Snapshot Now
        {isRecording && <span className="text-xs block text-gray-500">(Disabled during recording)</span>}
      </button>
      
    </div>
  );
}

