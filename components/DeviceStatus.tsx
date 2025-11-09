"use client";
import React, { useState, useEffect } from "react";

type Props = {
  deviceId: string;
  // Prop baru: timestamp (ms) kapan data terakhir diterima untuk device ini
  lastActivityTimestamp: number | null; 
};

// Batas waktu (ms) untuk dianggap offline (misal: 10 detik)
const OFFLINE_THRESHOLD_MS = 10000; 

export default function DeviceStatus({ deviceId, lastActivityTimestamp }: Props) {
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeenString, setLastSeenString] = useState<string>("--");

  useEffect(() => {
    // Cek status online setiap kali timestamp berubah
    if (lastActivityTimestamp) {
      const now = Date.now();
      // Dianggap online jika data terakhir diterima dalam OFFLINE_THRESHOLD_MS
      setIsOnline(now - lastActivityTimestamp < OFFLINE_THRESHOLD_MS);
      setLastSeenString(new Date(lastActivityTimestamp).toLocaleTimeString());
    } else {
      setIsOnline(false); // Jika belum pernah ada data, anggap offline
      setLastSeenString("--");
    }

    // Set interval untuk mengecek ulang status online secara berkala (misal setiap 2 detik)
    // agar status bisa berubah menjadi offline jika tidak ada data baru masuk
    const intervalId = setInterval(() => {
        if (lastActivityTimestamp) {
            setIsOnline(Date.now() - lastActivityTimestamp < OFFLINE_THRESHOLD_MS);
        } else {
            setIsOnline(false);
        }
    }, 2000); // Cek setiap 2 detik

    // Cleanup interval saat komponen unmount atau props berubah
    return () => clearInterval(intervalId);

  }, [lastActivityTimestamp]); // Efek ini dijalankan ulang saat lastActivityTimestamp berubah

  return (
    <div className="bg-gray-900/70 border border-green-800/30 rounded-lg p-4 w-full">
      <h4 className="text-green-400 font-semibold mb-2">Device Status</h4>
      <div className="flex items-center gap-3">
        {/* Indikator Online/Offline */}
        <div className={`w-3 h-3 rounded-full ${isOnline ? "bg-green-400 animate-pulse" : "bg-gray-600"}`}></div>
        <div>
          <div className="text-sm text-gray-300">{isOnline ? "Online" : "Offline"}</div>
          {/* Tampilkan waktu data terakhir diterima */}
          <div className="text-xs text-gray-500">
            Last data: {lastSeenString}
          </div>
        </div>
      </div>

      <div className="mt-3 text-sm text-gray-300">
        {/* Status streaming sekarang sama dengan status online */}
        <div>Streaming: <span className="text-white ml-1">{isOnline ? "Active" : "Stopped"}</span></div>
      </div>
    </div>
  );
}