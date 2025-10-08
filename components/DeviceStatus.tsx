"use client";
import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { rtdb } from "@/lib/firebase";

export default function DeviceStatus({ deviceId = "device1" }: { deviceId?: string }) {
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [streaming, setStreaming] = useState<boolean>(false);

  useEffect(() => {
    const lastRef = ref(rtdb, `devices/${deviceId}/lastSeen`);
    const streamRef = ref(rtdb, `devices/${deviceId}/streaming`);

    const unsub1 = onValue(lastRef, (snap) => {
      const v = snap.val();
      if (v) setLastSeen(Number(v));
      else setLastSeen(null);
    });

    const unsub2 = onValue(streamRef, (snap) => {
      const v = snap.val();
      setStreaming(Boolean(v));
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [deviceId]);

  const online = lastSeen ? Date.now() - lastSeen < 15000 : false; // 15s window

  return (
    <div className="bg-gray-900/70 border border-green-800/30 rounded-lg p-4 w-full md:w-56">
      <h4 className="text-green-300 font-semibold mb-2">Device Status</h4>
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${online ? "bg-green-400" : "bg-gray-600"}`}></div>
        <div>
          <div className="text-sm text-gray-300">{online ? "Online" : "Offline"}</div>
          <div className="text-xs text-gray-500">
            last seen: {lastSeen ? new Date(lastSeen).toLocaleTimeString() : "—"}
          </div>
        </div>
      </div>

      <div className="mt-3 text-sm text-gray-300">
        <div>Streaming: <span className="text-white ml-1">{streaming ? "Active" : "Stopped"}</span></div>
      </div>
    </div>
  );
}
