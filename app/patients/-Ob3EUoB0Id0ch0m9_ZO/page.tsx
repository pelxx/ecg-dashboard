"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ref as dbRef, push, set, get, remove } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import dynamic from "next/dynamic";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// NOTE: mqtt is imported dynamically inside startStream to avoid SSR issues

type RecordItem = {
  key: string;
  createdAt?: number;
  data?: number[];
};

export default function PatientMQTTPage({ params }: { params: { id: string } }) {
  const patientId = params.id;
  const router = useRouter();

  // patient info
  const [patient, setPatient] = useState<any>({});

  // ECG buffer for chart
  const [ecgBuffer, setEcgBuffer] = useState<number[]>([]);
  const bufferRef = useRef<number[]>([]); // keep mutable buffer for saving

  // records
  const [records, setRecords] = useState<RecordItem[]>([]);

  // MQTT client ref
  const mqttClientRef = useRef<any | null>(null);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);

  // UI state
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [saving, setSaving] = useState(false);

  // config
  const BROKER_WS = "wss://test.mosquitto.org:8081/mqtt";
  const TOPIC = `device/${patientId}/ecg`; // expected topic

  // load patient info (from RTDB /patients/{id})
  useEffect(() => {
    const pRef = dbRef(rtdb, `patients/${patientId}`);
    const unsub = (awaitOnValue(pRef, (snap: any) => {
      setPatient(snap.val() || {});
      setLoadingPatient(false);
    }));
    return () => unsub && unsub();
  }, [patientId]);

  // listen records list realtime
  useEffect(() => {
    const rRef = dbRef(rtdb, `records/${patientId}`);
    const unsub = (awaitOnValue(rRef, (snap: any) => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([k, v]: any) => ({
        key: k,
        createdAt: v.createdAt,
        data: v.data,
      }));
      arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setRecords(arr);
    }));
    return () => unsub && unsub();
  }, [patientId]);

  // helper: small wrapper to use onValue but avoid importing here repeatedly
  function awaitOnValue(refNode: any, cb: (snap: any) => void) {
    // dynamic require to avoid SSR bundling issues — but firebase DB functions are fine.
    // In your project you used onValue directly; if onValue is available, just use it.
    // Here we re-import onValue lazily to avoid linter/SSR problems
    const { onValue } = require("firebase/database");
    onValue(refNode, cb);
    return () => require("firebase/database").off(refNode); // not ideal but okay
  }

  // map ecgBuffer to chart data
  const chartData = ecgBuffer.slice(-800).map((v, i) => ({ i, value: v }));

  // ----- MQTT handling -----
  // connect & subscribe
  const startStream = async () => {
    if (mqttClientRef.current) return; // already connected
    try {
      const mqtt = await import("mqtt"); // dynamic import
      // create client
      const client = mqtt.connect(BROKER_WS, {
        clientId: `webclient_${Math.random().toString(16).slice(2, 8)}`,
        connectTimeout: 4000,
        reconnectPeriod: 2000,
      });

      client.on("connect", () => {
        console.log("MQTT connected");
        setConnected(true);
        // subscribe to topic
        client.subscribe(TOPIC, (err: any) => {
          if (err) console.error("subscribe err", err);
          else {
            console.log("subscribed to", TOPIC);
            setStreaming(true);
          }
        });
      });

      client.on("error", (err: any) => {
        console.error("MQTT error", err);
        client.end();
        setConnected(false);
        setStreaming(false);
      });

      client.on("message", (topic: string, message: Buffer | string) => {
        // message could be Buffer
        let text = typeof message === "string" ? message : message.toString();
        // try parse JSON. Expect payload: { samples: [..] } or [..]
        try {
          const parsed = JSON.parse(text);
          let samples: number[] = [];
          if (Array.isArray(parsed)) samples = parsed.map(Number);
          else if (parsed && Array.isArray(parsed.samples)) samples = parsed.samples.map(Number);
          else if (parsed && Array.isArray(parsed.data)) samples = parsed.data.map(Number);
          else {
            // if message is a single number or object with value
            if (typeof parsed === "number") samples = [Number(parsed)];
            else if (parsed && typeof parsed.value === "number") samples = [parsed.value];
          }

          if (samples.length > 0) {
            // update mutable buffer and state
            bufferRef.current = [...bufferRef.current, ...samples].slice(-5000);
            setEcgBuffer((prev) => {
              const merged = [...prev, ...samples].slice(-3000);
              return merged;
            });
          }
        } catch (e) {
          console.warn("Failed to parse MQTT payload", e, text);
        }
      });

      mqttClientRef.current = client;

      // also set devices/{id}/streaming = true for monitoring
      await set(dbRef(rtdb, `devices/${patientId}/streaming`), true);
      await set(dbRef(rtdb, `devices/${patientId}/lastSeen`), Date.now());
    } catch (e) {
      console.error("startStream error", e);
      alert("Gagal konek ke MQTT broker. Periksa koneksi atau CORS broker.");
    }
  };

  // unsubscribe & disconnect
  const stopStream = async (autoSave = true) => {
    if (!mqttClientRef.current) {
      setStreaming(false);
      return;
    }
    try {
      const client = mqttClientRef.current;
      client.unsubscribe(TOPIC, () => {
        client.end(true);
        mqttClientRef.current = null;
        setConnected(false);
        setStreaming(false);
      });
      // set device streaming flag false
      await set(dbRef(rtdb, `devices/${patientId}/streaming`), false);
      // if autoSave true, push buffer to records
      if (autoSave) {
        await saveCurrentBufferAsRecord();
      }
      // clear local buffer
      bufferRef.current = [];
      setEcgBuffer([]);
    } catch (e) {
      console.error("stopStream error", e);
    }
  };

  // save buffer to Firebase records/<patientId>/<timestamp>
  const saveCurrentBufferAsRecord = async () => {
    if (!bufferRef.current || bufferRef.current.length === 0) {
      return;
    }
    setSaving(true);
    try {
      const recRef = push(dbRef(rtdb, `records/${patientId}`));
      await set(recRef, {
        data: bufferRef.current.slice(), // copy
        createdAt: Date.now(),
      });
      // clear buffer after saving
      bufferRef.current = [];
      setEcgBuffer([]);
    } catch (e) {
      console.error("save record failed", e);
      alert("Gagal simpan rekaman");
    } finally {
      setSaving(false);
    }
  };

  // manual save button (in case you want saving without stop)
  const handleSaveNow = async () => {
    await saveCurrentBufferAsRecord();
  };

  // cleanup on unload
  useEffect(() => {
    return () => {
      if (mqttClientRef.current) {
        try {
          mqttClientRef.current.end(true);
        } catch (e) {}
      }
    };
  }, []);

  // utility: download record CSV
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
      a.download = `record_${patientId}_${key}.csv`;
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

  // device online detection from lastSeen field
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  useEffect(() => {
    const lastRef = dbRef(rtdb, `devices/${patientId}/lastSeen`);
    const onVal = require("firebase/database").onValue;
    onVal(lastRef, (snap: any) => {
      const v = snap.val();
      setLastSeen(v ? Number(v) : null);
    });
    return () => require("firebase/database").off(lastRef);
  }, [patientId]);
  const online = lastSeen ? Date.now() - lastSeen < 15000 : false;

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-blue-300">Patient Stream — {patientId}</h1>
            <p className="text-sm text-gray-400">{patient.nama || "—"} · {patient.umur ? `${patient.umur} tahun` : "—"}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/patients")} className="px-3 py-2 rounded bg-gray-800 text-gray-200">← Back</button>
            {!streaming ? (
              <button onClick={startStream} className="px-3 py-2 rounded bg-green-600 text-black font-semibold">▶ Start Stream</button>
            ) : (
              <button onClick={() => stopStream(true)} className="px-3 py-2 rounded bg-red-600 text-white">■ Stop & Save</button>
            )}
            <button onClick={handleSaveNow} className="px-3 py-2 rounded bg-blue-500 text-black">Save Now</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="col-span-1 bg-gray-900/60 p-4 rounded-lg border border-blue-900/30">
            <h3 className="text-lg font-semibold text-white mb-2">Patient Info</h3>
            <div className="text-sm text-gray-300 space-y-1">
              <div><span className="text-gray-400">Nama:</span> <span className="text-white">{patient.nama || "—"}</span></div>
              <div><span className="text-gray-400">Umur:</span> <span className="text-white">{patient.umur ?? "—"}</span></div>
              <div><span className="text-gray-400">Jenis Kelamin:</span> <span className="text-white">{patient.jenis_kelamin || "—"}</span></div>
            </div>
            <div className="mt-3">
              <div className="text-sm text-gray-300">Device: <span className="ml-2">{online ? "Online" : "Offline"}</span></div>
              <div className="text-xs text-gray-500">last seen: {lastSeen ? new Date(lastSeen).toLocaleTimeString() : "-"}</div>
            </div>
          </div>

          <div className="col-span-2 bg-gray-900/60 p-4 rounded-lg border border-blue-900/30">
            <h3 className="text-lg font-semibold text-white mb-2">ECG — Realtime Stream</h3>
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#0f1724" strokeDasharray="2 2" />
                  <XAxis dataKey="i" hide />
                  <YAxis domain={["auto", "auto"]} tick={{ fill: "#9ae6b4", fontSize: 11 }} width={40} />
                  <Tooltip contentStyle={{ background: "#0b1220" }} itemStyle={{ color: "#9ae6b4" }} />
                  <Line isAnimationActive={false} dot={false} dataKey="value" stroke="#00ff7f" strokeWidth={1.6} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-gray-400">Showing last {ecgBuffer.length} samples (rolling).</div>
          </div>
        </div>

        {/* records list */}
        <div className="bg-gray-900/60 p-4 rounded-lg border border-blue-900/30">
          <h3 className="text-lg font-semibold text-white mb-2">Recorded Sessions</h3>
          {records.length === 0 ? (
            <div className="text-gray-400">Belum ada rekaman.</div>
          ) : (
            <div className="grid gap-2">
              {records.map((r) => (
                <div key={r.key} className="flex items-center justify-between bg-black/30 p-2 rounded">
                  <div>
                    <div className="text-sm text-white">{r.createdAt ? new Date(r.createdAt).toLocaleString() : r.key}</div>
                    <div className="text-xs text-gray-400">{r.data ? `${r.data.length} samples` : "-"}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => downloadRecord(r.key)} className="px-2 py-1 rounded bg-blue-500 text-black text-sm">Download</button>
                    <button onClick={() => deleteRecord(r.key)} className="px-2 py-1 rounded bg-red-600 text-white text-sm">Hapus</button>
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
