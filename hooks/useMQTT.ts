"use client";
import { useEffect, useRef, useState } from "react";
import mqtt, { MqttClient } from "mqtt";

type ECGDataPoint = { timestamp: number; value: number };
const ECG_SAMPLE_RATE_HZ = 500;
const ECG_SAMPLE_INTERVAL_MS = 1000 / ECG_SAMPLE_RATE_HZ;

interface AllLeadsData {
  [deviceId: string]: {
    lead1: ECGDataPoint[];
    lead2: ECGDataPoint[];
    lead3: ECGDataPoint[];
  };
}

// =====================
// HELPER FUNCTIONS
// =====================
const toFiniteNumber = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeEpochMillis = (value: unknown): number | null => {
  const n = toFiniteNumber(value);
  if (n === null) return null;
  return n < 1e11 ? n * 1000 : n;
};

type MqttPayload = Record<string, unknown>;

type UseMQTTOptions = {
  selectedKey: string | null;
  paperSpeed: number;
  recordingStatus: Record<string, boolean>;
};

const pickIntervalMs = (payload: MqttPayload): number => {
  const direct =
    toFiniteNumber(payload.sampleIntervalMs) ??
    toFiniteNumber(payload.intervalMs) ??
    toFiniteNumber(payload.interval);

  if (direct && direct > 0) return direct;

  const sr = toFiniteNumber(payload.sampleRateHz);
  if (sr && sr > 0) return 1000 / sr;

  return ECG_SAMPLE_INTERVAL_MS;
};

const pickLeadArray = (raw: unknown): number[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => toFiniteNumber(v))
    .filter((v): v is number => v !== null);
};

// =====================
// MAIN HOOK
// =====================
export const useMQTT = ({
  paperSpeed,
}: UseMQTTOptions) => {
  const [liveEcgData, setLiveEcgData] = useState<AllLeadsData>({});
  const [liveBPM, setLiveBPM] = useState<Record<string, number>>({});
  const [lastDeviceActivity, setLastDeviceActivity] = useState<
    Record<string, number>
  >({});

  const mqttRef = useRef<MqttClient | null>(null);
  const bufferRef = useRef<AllLeadsData>({});
  const lastTsRef = useRef<Record<string, number>>({});
  const lastSeqRef = useRef<Record<string, number>>({});

  // =====================
  // MONOTONIC TIMESTAMP FIX
  // =====================
  const mapToPoints = (
    arr: number[],
    start: number,
    interval: number,
    key: string
  ): ECGDataPoint[] => {
    let ts = start;
    const last = lastTsRef.current[key];

    if (last !== undefined && ts <= last) {
      ts = last + interval;
    }

    return arr.map((v, i) => {
      const cur = ts + i * interval;
      lastTsRef.current[key] = cur;
      return { timestamp: cur, value: v };
    });
  };

  // =====================
  // MQTT CONNECT
  // =====================
  useEffect(() => {
    const client = mqtt.connect(
      process.env.NEXT_PUBLIC_MQTT_BROKER_URL ||
        "wss://broker.emqx.io:8084/mqtt"
    );

    mqttRef.current = client;

    client.on("connect", () => {
      console.log("MQTT CONNECTED");
      client.subscribe("ecg/+/realtime");
      client.subscribe("devices/+/status");
    });

    client.on("message", (topic, message) => {
      try {
        const parts = topic.split("/");
        if (parts.length < 3) return;
        const [root, deviceId, event] = parts;
        if (!deviceId) return;

        const payload = JSON.parse(message.toString()) as MqttPayload;

        // =====================
        // REALTIME ECG
        // =====================
        if (root === "ecg" && event === "realtime") {
          const start = normalizeEpochMillis(
            payload.startMillis ?? payload.timestamp
          );
          const interval = pickIntervalMs(payload);
          const seq = toFiniteNumber(payload.chunkSeq);

          if (!start) return;

          // ==== ANTI DUPLICATE CHUNK ====
          const lastSeq = lastSeqRef.current[deviceId];
          if (seq !== null && lastSeq !== undefined && seq <= lastSeq) return;
          if (seq !== null) lastSeqRef.current[deviceId] = seq;

          const lead1 = pickLeadArray(payload.lead1);
          const lead2 = pickLeadArray(payload.lead2);
          const lead3 = pickLeadArray(payload.lead3);

          if (!bufferRef.current[deviceId]) {
            bufferRef.current[deviceId] = {
              lead1: [],
              lead2: [],
              lead3: [],
            };
          }

          bufferRef.current[deviceId].lead1.push(
            ...mapToPoints(lead1, start, interval, `${deviceId}:lead1`)
          );
          bufferRef.current[deviceId].lead2.push(
            ...mapToPoints(lead2, start, interval, `${deviceId}:lead2`)
          );
          bufferRef.current[deviceId].lead3.push(
            ...mapToPoints(lead3, start, interval, `${deviceId}:lead3`)
          );

          const bpm = toFiniteNumber(payload.bpm);
          if (bpm !== null) {
            setLiveBPM((p) => ({ ...p, [deviceId]: bpm }));
          }

          setLastDeviceActivity((p) => ({
            ...p,
            [deviceId]: Date.now(),
          }));
        }

        // =====================
        // STATUS
        // =====================
        if (root === "devices" && event === "status") {
          setLastDeviceActivity((p) => ({
            ...p,
            [deviceId]: Date.now(),
          }));
        }
      } catch (e) {
        console.error("MQTT PARSE ERROR", e);
      }
    });

    return () => {
      client.end();
    };
  }, []);

  // =====================
  // BUFFER → STATE
  // =====================
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveEcgData((prev) => {
        const newData: AllLeadsData = { ...prev };

        for (const id in bufferRef.current) {
          const buf = bufferRef.current[id];
          const prevData = prev[id] || {
            lead1: [],
            lead2: [],
            lead3: [],
          };

          const maxPoints = Math.max(
            ECG_SAMPLE_RATE_HZ,
            Math.ceil((paperSpeed / 1000) * ECG_SAMPLE_RATE_HZ)
          );

          newData[id] = {
            lead1: [...prevData.lead1, ...buf.lead1].slice(-maxPoints),
            lead2: [...prevData.lead2, ...buf.lead2].slice(-maxPoints),
            lead3: [...prevData.lead3, ...buf.lead3].slice(-maxPoints),
          };

          buf.lead1.length = 0;
          buf.lead2.length = 0;
          buf.lead3.length = 0;
        }

        return newData;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [paperSpeed]);

  return {
    liveEcgData,
    liveBPM,
    lastDeviceActivity,
  };
};
