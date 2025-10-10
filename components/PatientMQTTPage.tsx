"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ref as dbRef, push, set, get, remove, onValue, off } from "firebase/database";
import { rtdb } from "@/lib/firebase";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type RecordItem = {
  key: string;
  createdAt?: number;
  data?: number[];
};

const CONFIG = {
  BROKER_WS: "wss://broker.emqx.io:8084/mqtt",  // EDIT: Ganti ke broker lebih stabil (update di simulator juga!)
  MAX_BUFFER_SIZE: 5000,
  MAX_CHART_POINTS: 800,
  DEVICE_ONLINE_THRESHOLD: 15000, // 15 seconds
  RECONNECT_PERIOD: 5000,
  CONNECT_TIMEOUT: 10000,
};

export default function PatientMQTTPage({ params }: { params?: { id?: string } }) {
  const patientId = params?.id || "no-id";
  console.log("Patient ID:", patientId);
  const router = useRouter();

  // Patient info
  const [patient, setPatient] = useState<any>({});
  const [loadingPatient, setLoadingPatient] = useState(true);

  // ECG buffer
  const [ecgBuffer, setEcgBuffer] = useState<number[]>([]);
  const bufferRef = useRef<number[]>([]);
  const lastUpdateRef = useRef<number>(Date.now());

  // Records
  const [records, setRecords] = useState<RecordItem[]>([]);

  // MQTT state
  const mqttClientRef = useRef<any | null>(null);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [mqttError, setMqttError] = useState<string | null>(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [lastSeen, setLastSeen] = useState<number | null>(null);

  const TOPIC = `ecg/${patientId}/realtime`;

  // ========== FIREBASE LISTENERS ==========
  
  // Load patient info
  useEffect(() => {
    const pRef = dbRef(rtdb, `patients/${patientId}`);
    const unsubscribe = onValue(pRef, (snap) => {
      setPatient(snap.val() || {});
      setLoadingPatient(false);
    });
    return () => off(pRef);
  }, [patientId]);

  // Listen to records
  useEffect(() => {
    const rRef = dbRef(rtdb, `records/${patientId}`);
    const unsubscribe = onValue(rRef, (snap) => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([k, v]: any) => ({
        key: k,
        createdAt: v.createdAt,
        data: v.data,
      }));
      arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setRecords(arr);
    });
    return () => off(rRef);
  }, [patientId]);

  // Listen to device lastSeen
  useEffect(() => {
    const lastRef = dbRef(rtdb, `devices/${patientId}/lastSeen`);
    const unsubscribe = onValue(lastRef, (snap) => {
      const v = snap.val();
      setLastSeen(v ? Number(v) : null);
    });
    return () => off(lastRef);
  }, [patientId]);

  // Derived state: device online
  const online = lastSeen ? Date.now() - lastSeen < CONFIG.DEVICE_ONLINE_THRESHOLD : false;

  // ========== MQTT FUNCTIONS ==========

  // Handle incoming MQTT message
  const handleMqttMessage = useCallback((topic: string, message: Buffer | string) => {
    try {
      const text = typeof message === "string" ? message : message.toString();
      console.log("📨 MQTT Message received:", { topic, rawMessage: text });  // EDIT: Tambah log debug (hapus nanti jika OK)
      
      const parsed = JSON.parse(text);
      
      let samples: number[] = [];
      
      // Parse different payload formats
      if (Array.isArray(parsed)) {
        samples = parsed.map(Number);
      } else if (parsed && Array.isArray(parsed.samples)) {
        samples = parsed.samples.map(Number);
      } else if (parsed && Array.isArray(parsed.data)) {
        samples = parsed.data.map(Number);
      } else if (typeof parsed === "number") {
        samples = [Number(parsed)];
      } else if (parsed && typeof parsed.value === "number") {
        samples = [parsed.value];
      }

      if (samples.length > 0) {
        console.log("✅ Parsed samples:", samples.length);  // EDIT: Tambah log debug (hapus nanti jika OK)
        // Update mutable buffer
        bufferRef.current = [...bufferRef.current, ...samples].slice(-CONFIG.MAX_BUFFER_SIZE);
        
        // Throttle state updates (max 10 fps)
        const now = Date.now();
        if (now - lastUpdateRef.current > 100) {
          lastUpdateRef.current = now;
          setEcgBuffer([...bufferRef.current]);
        }
      }
    } catch (e) {
      console.warn("Failed to parse MQTT payload:", e, Text);  // EDIT: Tambah 'text' untuk debug
    }
  }, []);

  // Start MQTT stream
  const startStream = async () => {
    if (mqttClientRef.current) {
      console.warn("MQTT already connected");
      return;
    }

    setMqttError(null);

    try {
      // EDIT: Fix dynamic import - ambil default export
      const mqtt = (await import("mqtt")).default;
      
      const client = mqtt.connect(CONFIG.BROKER_WS, {
        clientId: `ecg_web_${Math.random().toString(16).slice(2, 8)}`,
        connectTimeout: CONFIG.CONNECT_TIMEOUT,
        reconnectPeriod: CONFIG.RECONNECT_PERIOD,
        keepalive: 60,
        clean: true,
        // rejectUnauthorized: false,  // EDIT: Uncomment jika SSL error (test only, insecure!)
      });

      // Connection successful
      client.on("connect", () => {
        console.log("✅ MQTT connected");
        setConnected(true);
        setMqttError(null);
        
        client.subscribe(TOPIC, { qos: 0 }, (err) => {
          if (err) {
            console.error("Subscribe error:", err);
            setMqttError("Failed to subscribe");
          } else {
            console.log("📡 Subscribed to:", TOPIC);
            setStreaming(true);
            // Update device status
            set(dbRef(rtdb, `devices/${patientId}/streaming`), true);
            set(dbRef(rtdb, `devices/${patientId}/lastSeen`), Date.now());
          }
        });
      });

      // Handle errors
      client.on("error", (err) => {
        console.error("❌ MQTT error:", err.message);
        setMqttError(err.message);
      });

      // Handle offline
      client.on("offline", () => {
        console.warn("⚠️ MQTT offline");
        setConnected(false);
        setStreaming(false);
      });

      // Handle reconnect
      client.on("reconnect", () => {
        console.log("🔄 MQTT reconnecting...");
        setMqttError("Reconnecting...");
      });

      // Handle disconnect
      client.on("close", () => {
        console.log("🔌 MQTT connection closed");
        setConnected(false);
        setStreaming(false);
      });

      // Handle messages
      client.on("message", handleMqttMessage);

      mqttClientRef.current = client;

    } catch (e: any) {
      // EDIT: Improve error logging dan alert
      console.error("Detailed error in startStream:", e);
      setMqttError(e.message || "Failed to connect");
      alert(`Gagal start MQTT: ${e.message}. Pastikan 'mqtt' terinstall (npm install mqtt) dan coba ganti broker jika koneksi issue.`);
    }
  };

  // Stop MQTT stream
  const stopStream = async (autoSave = true) => {
    const client = mqttClientRef.current;
    if (!client) {
      setStreaming(false);
      return;
    }

    try {
      // Unsubscribe first
      client.unsubscribe(TOPIC, (err: any) => {
        if (err) console.error("Unsubscribe error:", err);
      });

      // End connection
      client.end(true, {}, () => {
        console.log("✅ MQTT disconnected");
        mqttClientRef.current = null;
        setConnected(false);
        setStreaming(false);
        setMqttError(null);
      });

      // Update device status
      await set(dbRef(rtdb, `devices/${patientId}/streaming`), false);

      // Auto-save if requested
      if (autoSave && bufferRef.current.length > 0) {
        await saveCurrentBufferAsRecord();
      }

    } catch (e) {
      console.error("Error stopping stream:", e);
    }
  };

  // Save buffer to Firebase
  const saveCurrentBufferAsRecord = async () => {
    if (!bufferRef.current || bufferRef.current.length === 0) {
      alert("Tidak ada data untuk disimpan");
      return;
    }

    setSaving(true);
    try {
      const recRef = push(dbRef(rtdb, `records/${patientId}`));
      await set(recRef, {
        data: bufferRef.current.slice(),
        createdAt: Date.now(),
      });

      console.log(`✅ Saved ${bufferRef.current.length} samples`);
      
      // Clear buffer after saving
      bufferRef.current = [];
      setEcgBuffer([]);

    } catch (e) {
      console.error("Save failed:", e);
      alert("Gagal simpan rekaman");
    } finally {
      setSaving(false);
    }
  };

  // Manual save button
  const handleSaveNow = async () => {
    if (bufferRef.current.length === 0) {
      alert("Buffer kosong, tidak ada yang disimpan");
      return;
    }
    await saveCurrentBufferAsRecord();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mqttClientRef.current) {
        try {
          mqttClientRef.current.end(true);
          mqttClientRef.current = null;
        } catch (e) {
          console.error("Cleanup error:", e);
        }
      }
    };
  }, []);

  // ========== RECORD MANAGEMENT ==========

  const downloadRecord = async (key: string) => {
    try {
      const snap = await get(dbRef(rtdb, `records/${patientId}/${key}`));
      const val = snap.exists() ? snap.val() : null;
      
      if (!val || !val.data) {
        alert("Tidak ada data pada record ini.");
        return;
      }

      const arr: number[] = Array.isArray(val.data) ? val.data : Object.values(val.data);
      const csv = arr.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ecg_${patientId}_${key}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Gagal download record");
    }
  };

  const deleteRecord = async (key: string) => {
    if (!confirm("Yakin hapus record ini?")) return;
    try {
      await remove(dbRef(rtdb, `records/${patientId}/${key}`));
    } catch (e) {
      console.error(e);
      alert("Gagal hapus record");
    }
  };

  // ========== CHART DATA ==========
  
  // Only take last N points for chart performance
  const chartData = ecgBuffer
    .slice(-CONFIG.MAX_CHART_POINTS)
    .map((v, i) => ({ i, value: v }));

  // ========== RENDER ==========

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-blue-300">
              Patient Stream — {patientId}
            </h1>
            <p className="text-sm text-gray-400">
              {patient.nama || "—"} · {patient.umur ? `${patient.umur} tahun` : "—"}
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => router.push("/patients")} 
              className="px-3 py-2 rounded bg-gray-800 text-gray-200 hover:bg-gray-700"
            >
              ← Back
            </button>
            {!streaming ? (
              <button 
                onClick={startStream} 
                disabled={connected}
                className="px-3 py-2 rounded bg-green-600 text-black font-semibold hover:bg-green-500 disabled:opacity-50"
              >
                ▶ Start Stream
              </button>
            ) : (
              <button 
                onClick={() => stopStream(true)} 
                className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-500"
              >
                ■ Stop & Save
              </button>
            )}
            <button 
              onClick={handleSaveNow} 
              disabled={saving || bufferRef.current.length === 0}
              className="px-3 py-2 rounded bg-blue-500 text-black hover:bg-blue-400 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Now"}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {mqttError && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 p-3 rounded">
            ⚠️ MQTT Error: {mqttError}
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Patient Info */}
          <div className="col-span-1 bg-gray-900/60 p-4 rounded-lg border border-blue-900/30">
            <h3 className="text-lg font-semibold text-white mb-2">Patient Info</h3>
            <div className="text-sm text-gray-300 space-y-1">
              <div>
                <span className="text-gray-400">Nama:</span>{" "}
                <span className="text-white">{patient.nama || "—"}</span>
              </div>
              <div>
                <span className="text-gray-400">Umur:</span>{" "}
                <span className="text-white">{patient.umur ?? "—"}</span>
              </div>
              <div>
                <span className="text-gray-400">Jenis Kelamin:</span>{" "}
                <span className="text-white">{patient.jenis_kelamin || "—"}</span>
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-700">
              <div className="text-sm text-gray-300 mb-1">
                Device:{" "}
                <span className={`ml-2 font-semibold ${online ? "text-green-400" : "text-red-400"}`}>
                  {online ? "🟢 Online" : "🔴 Offline"}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Last seen: {lastSeen ? new Date(lastSeen).toLocaleTimeString() : "—"}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="text-sm text-gray-300">
                MQTT:{" "}
                <span className={`ml-2 font-semibold ${connected ? "text-green-400" : "text-gray-500"}`}>
                  {connected ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Buffer: {bufferRef.current.length.toLocaleString()} samples
              </div>
            </div>
          </div>

                   {/* ECG Chart */}
          <div className="col-span-2 bg-gray-900/60 p-4 rounded-lg border border-blue-900/30">
            <h3 className="text-lg font-semibold text-white mb-2">
              ECG — Realtime Stream
            </h3>
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#0f1724" strokeDasharray="2 2" />
                  <XAxis dataKey="i" hide />
                  <YAxis 
                    domain={["auto", "auto"]} 
                    tick={{ fill: "#9ae6b4", fontSize: 11 }} 
                    width={40} 
                  />
                  <Tooltip 
                    contentStyle={{ background: "#0b1220", border: "1px solid #1e3a5f" }} 
                    itemStyle={{ color: "#9ae6b4" }} 
                  />
                  <Line 
                    isAnimationActive={false} 
                    dot={false} 
                    dataKey="value" 
                    stroke="#00ff7f" 
                    strokeWidth={1.6} 
                    type="monotone" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Showing last {chartData.length} samples (max {CONFIG.MAX_CHART_POINTS})
            </div>
          </div>
        </div>

        {/* Records List */}
        <div className="bg-gray-900/60 p-4 rounded-lg border border-blue-900/30">
          <h3 className="text-lg font-semibold text-white mb-3">Recorded Sessions</h3>
          {records.length === 0 ? (
            <div className="text-gray-400 text-center py-8">Belum ada rekaman.</div>
          ) : (
            <div className="grid gap-2">
              {records.map((r) => (
                <div 
                  key={r.key} 
                  className="flex items-center justify-between bg-black/30 p-3 rounded hover:bg-black/50 transition-colors"
                >
                  <div>
                    <div className="text-sm text-white font-medium">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : r.key}
                    </div>
                    <div className="text-xs text-gray-400">
                      {r.data ? `${r.data.length.toLocaleString()} samples` : "—"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => downloadRecord(r.key)} 
                      className="px-3 py-1 rounded bg-blue-500 text-black text-sm hover:bg-blue-400 transition-colors"
                    >
                      📥 Download
                    </button>
                    <button 
                      onClick={() => deleteRecord(r.key)} 
                      className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-500 transition-colors"
                    >
                      🗑️ Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}