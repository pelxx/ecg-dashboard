"use client";
import React, { useState } from "react";
import { ref, set, push } from "firebase/database";
import { rtdb } from "@/lib/firebase";

export default function ControlPanel({
  deviceId = "device1",
  onManualSave,
}: {
  deviceId?: string;
  onManualSave?: () => void;
}) {
  const [processing, setProcessing] = useState(false);

  const toggleStreaming = async (enable: boolean) => {
    setProcessing(true);
    try {
      await set(ref(rtdb, `devices/${deviceId}/streaming`), enable);
      // optionally update lastSeen when turning on
      if (enable) {
        await set(ref(rtdb, `devices/${deviceId}/lastSeen`), Date.now());
      }
    } catch (e) {
      console.error("toggleStreaming error", e);
    } finally {
      setProcessing(false);
    }
  };

  const saveSnapshot = async () => {
    setProcessing(true);
    try {
      // push empty record placeholder; frontend can request current data then save
      const recRef = push(ref(rtdb, `ecg/records`));
      await set(recRef, { createdAt: Date.now(), note: "manual-save" });
      if (onManualSave) onManualSave();
    } catch (e) {
      console.error("saveSnapshot error", e);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="bg-gray-900/70 border border-green-800/30 rounded-lg p-4 flex flex-col gap-3 w-full md:w-80">
      <h4 className="text-green-300 font-semibold">Control Panel</h4>

      <div className="flex gap-2">
        <button
          onClick={() => toggleStreaming(true)}
          disabled={processing}
          className="flex-1 py-2 rounded bg-green-600 hover:bg-green-500 text-black font-semibold"
        >
          ▶ Start
        </button>
        <button
          onClick={() => toggleStreaming(false)}
          disabled={processing}
          className="flex-1 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white font-semibold"
        >
          ■ Stop
        </button>
      </div>

      <button
        onClick={saveSnapshot}
        disabled={processing}
        className="py-2 rounded border border-green-700 text-green-200 hover:bg-green-900/20"
      >
        ⤓ Save Snapshot
      </button>

      <div className="text-sm text-gray-400 mt-2">Note: ESP32 harus membaca streaming flag untuk mulai/stop kirim data.</div>
    </div>
  );
}
