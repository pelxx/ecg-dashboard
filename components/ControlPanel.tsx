"use client";
import React, { useState } from "react";

// PERBAIKAN: Ubah tipe props agar sesuai dengan yang dikirim dari parent
type Props = {
  deviceId: string;
  onCommand: (deviceId: string, command: 'start' | 'stop') => void;
  onManualSave: (deviceId: string) => void; // <--- Diubah di sini
};

export default function ControlPanel({ deviceId, onCommand, onManualSave }: Props) {
  const [processing, setProcessing] = useState(false);

  const handleCommand = async (command: 'start' | 'stop') => {
    setProcessing(true);
    // Panggil onCommand dengan deviceId
    onCommand(deviceId, command);
    // Asumsi perintah cepat, bisa dibuat async jika perlu
    setTimeout(() => setProcessing(false), 500); 
  };
  
  const handleSave = async () => {
    setProcessing(true);
    // Panggil onManualSave dengan deviceId
    onManualSave(deviceId);
    setTimeout(() => setProcessing(false), 1000);
  };

  return (
    <div className="bg-gray-900/70 border border-green-800/30 rounded-lg p-4 flex flex-col gap-3 w-full">
      <h4 className="text-green-300 font-semibold">Control Panel</h4>

      <div className="flex gap-2">
        <button onClick={() => handleCommand('start')} disabled={processing} className="flex-1 py-2 rounded bg-green-600 hover:bg-green-500 text-black font-semibold">
          ▶ Start Streaming
        </button>
        <button onClick={() => handleCommand('stop')} disabled={processing} className="flex-1 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white font-semibold">
          ■ Stop Streaming
        </button>
      </div>

      <button onClick={handleSave} disabled={processing} className="py-2 rounded border border-green-700 text-green-200 hover:bg-green-900/20">
        ⤓ Save Snapshot to Logger
      </button>
    </div>
  );
}