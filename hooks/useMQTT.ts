"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  ECG_SAMPLE_RATE_HZ,
  DEFAULT_ECG_WINDOW_MS,
} from "@/constants/ecg";
import { MQTT_BROKER_URL, MQTT_TOPICS } from "@/constants/mqtt";
import { CircularBuffer } from "@/components/ecg/buffer/CircularBuffer";
import {
  MQTTService,
  createDefaultECGPoint,
} from "@/services/mqtt.service";
import type { ECGDataPoint, ECGLeadKey, ECGLeadSeries } from "@/types/ecg";
import type { MQTTConnectionState, MQTTDeviceStatus } from "@/types/mqtt";

type AllLeadsData = Record<string, ECGLeadSeries>;

type DeviceBuffers = Record<ECGLeadKey, CircularBuffer<ECGDataPoint>>;

type UseMQTTOptions = {
  readonly selectedKey?: string | null;
  readonly paperSpeed: number;
  readonly recordingStatus?: Readonly<Record<string, boolean>>;
};

const emptySeries: ECGLeadSeries = {
  lead1: [],
  lead2: [],
  lead3: [],
};

const createDeviceBuffers = (capacity: number): DeviceBuffers => ({
  lead1: CircularBuffer.create(capacity, createDefaultECGPoint()),
  lead2: CircularBuffer.create(capacity, createDefaultECGPoint()),
  lead3: CircularBuffer.create(capacity, createDefaultECGPoint()),
});

const mapToPoints = (
  samples: readonly number[],
  startMillis: number,
  intervalMs: number,
  key: string,
  lastTimestampRef: MutableRefObject<Record<string, number>>
): readonly ECGDataPoint[] => {
  let firstTimestamp = startMillis;
  const lastTimestamp = lastTimestampRef.current[key];

  if (lastTimestamp !== undefined && firstTimestamp <= lastTimestamp) {
    firstTimestamp = lastTimestamp + intervalMs;
  }

  return samples.map((value, index) => {
    const timestamp = firstTimestamp + index * intervalMs;
    lastTimestampRef.current[key] = timestamp;
    return { timestamp, value };
  });
};

const initialConnectionState: MQTTConnectionState = {
  status: "idle",
  connected: false,
  error: null,
};

export const useMQTT = ({ paperSpeed,recordingStatus }: UseMQTTOptions) => {
  const [liveEcgData, setLiveEcgData] = useState<AllLeadsData>({});
  const [liveBPM, setLiveBPM] = useState<Record<string, number>>({});
  const [lastDeviceActivity, setLastDeviceActivity] = useState<Record<string, number>>(
    {}
  );
  const [connectionState, setConnectionState] =
    useState<MQTTConnectionState>(initialConnectionState);
  const [deviceStatuses, setDeviceStatuses] = useState<
    Record<string, MQTTDeviceStatus>
  >({});
  const [invalidPayloadCount, setInvalidPayloadCount] = useState(0);

  const serviceRef = useRef<MQTTService | null>(null);
  const buffersRef = useRef<Record<string, DeviceBuffers>>({});
  const recordingBuffersRef = useRef<
  Record<
    string,
    {
      startTime: number;
      lead1: ECGDataPoint[];
      lead2: ECGDataPoint[];
      lead3: ECGDataPoint[];
    }
  >
>({});
const recordingStatusRef = useRef<
  Readonly<Record<string, boolean>>
>({});
  const lastTimestampRef = useRef<Record<string, number>>({});
  const lastSequenceRef = useRef<Record<string, number>>({});
  const capacityRef = useRef(
    Math.ceil((DEFAULT_ECG_WINDOW_MS / 1000) * ECG_SAMPLE_RATE_HZ)
  );

  useEffect(() => {
    capacityRef.current = Math.max(
      ECG_SAMPLE_RATE_HZ,
      Math.ceil((paperSpeed / 1000) * ECG_SAMPLE_RATE_HZ)
    );
  }, [paperSpeed]);

  useEffect(() => {
  recordingStatusRef.current = recordingStatus ?? {};
}, [recordingStatus]);

  useEffect(() => {
    const service = new MQTTService();
    serviceRef.current = service;

    service.connect({
      brokerUrl: MQTT_BROKER_URL,
      topics: MQTT_TOPICS,
      onConnectionChange: setConnectionState,
      onMessage: (event) => {
        if (event.type === "invalid") {
          setInvalidPayloadCount((count) => count + 1);
          return;
        }

        if (event.type === "status") {
          setDeviceStatuses((previous) => ({
            ...previous,
            [event.status.deviceId]: event.status,
          }));
          setLastDeviceActivity((previous) => ({
            ...previous,
            [event.status.deviceId]: event.status.lastSeen,
          }));
          return;
        }

        const { packet } = event;
        const lastSequence = lastSequenceRef.current[packet.deviceId];
        if (
          packet.chunkSeq !== null &&
          lastSequence !== undefined &&
          packet.chunkSeq <= lastSequence
        ) {
          return;
        }

        if (packet.chunkSeq !== null) {
          lastSequenceRef.current[packet.deviceId] = packet.chunkSeq;
        }

        if (!buffersRef.current[packet.deviceId]) {
          buffersRef.current[packet.deviceId] = createDeviceBuffers(
            capacityRef.current
          );
        }

        const buffers = buffersRef.current[packet.deviceId];
        const lead1Points = mapToPoints(
  packet.lead1,
  packet.startMillis,
  packet.sampleIntervalMs,
  `${packet.deviceId}:lead1`,
  lastTimestampRef
);

const lead2Points = mapToPoints(
  packet.lead2,
  packet.startMillis,
  packet.sampleIntervalMs,
  `${packet.deviceId}:lead2`,
  lastTimestampRef
);

const lead3Points = mapToPoints(
  packet.lead3,
  packet.startMillis,
  packet.sampleIntervalMs,
  `${packet.deviceId}:lead3`,
  lastTimestampRef
);
       buffers.lead1.pushChunk(lead1Points);
buffers.lead2.pushChunk(lead2Points);
buffers.lead3.pushChunk(lead3Points);

if (recordingStatusRef.current[packet.deviceId]) {

  if (!recordingBuffersRef.current[packet.deviceId]) {
    recordingBuffersRef.current[packet.deviceId] = {
      startTime: packet.startMillis,
      lead1: [],
      lead2: [],
      lead3: [],
    };
  }

  const record = recordingBuffersRef.current[packet.deviceId]!;

  record.lead1.push(...lead1Points);
  record.lead2.push(...lead2Points);
  record.lead3.push(...lead3Points);
  console.log(
  "[Recording]",
  packet.deviceId,
  record.lead1.length
);
}

        if (packet.bpm !== null) {
          setLiveBPM((previous) => ({
            ...previous,
            [packet.deviceId]: packet.bpm ?? 0,
          }));
        }

        setLastDeviceActivity((previous) => ({
          ...previous,
          [packet.deviceId]: packet.receivedAt,
        }));
      },
    });

    return () => {
      service.cleanup();
      serviceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLiveEcgData(() => {
        const nextData: AllLeadsData = {};

        for (const [deviceId, buffers] of Object.entries(buffersRef.current)) {
          nextData[deviceId] = {
            lead1: buffers.lead1.snapshot(),
            lead2: buffers.lead2.snapshot(),
            lead3: buffers.lead3.snapshot(),
          };
        }

        return nextData;
      });
    }, 100);

    return () => window.clearInterval(timer);
  }, []);

  const clearBuffer = useCallback((deviceId?: string) => {
    const targetIds = deviceId ? [deviceId] : Object.keys(buffersRef.current);

    for (const targetId of targetIds) {
      buffersRef.current[targetId]?.lead1.clear();
      buffersRef.current[targetId]?.lead2.clear();
      buffersRef.current[targetId]?.lead3.clear();
    }

    setLiveEcgData((previous) => {
      if (!deviceId) return {};
      return { ...previous, [deviceId]: emptySeries };
    });
  }, []);

  const reconnectMQTT = useCallback(() => {
    serviceRef.current?.reconnect();
  }, []);

  const publish = useCallback((topic: string, payload: unknown) => {
    serviceRef.current?.publish(topic, payload);
  }, []);
  const getBufferSnapshot = useCallback((deviceId: string) => {
  const buffers = buffersRef.current[deviceId];

  if (!buffers) {
    return null;
  }

  return {
    lead1: buffers.lead1.snapshot(),
    lead2: buffers.lead2.snapshot(),
    lead3: buffers.lead3.snapshot(),
  };
}, []);
const getRecordingBuffer = useCallback((deviceId: string) => {
  return recordingBuffersRef.current[deviceId] ?? null;
}, []);

const clearRecordingBuffer = useCallback((deviceId: string) => {
  delete recordingBuffersRef.current[deviceId];
}, []);
  return {
    liveEcgData,
    liveBPM,
    lastDeviceActivity,
    connectionState,
    deviceStatuses,
    invalidPayloadCount,
    clearBuffer,
    reconnectMQTT,
    publish,
    getBufferSnapshot,
    getRecordingBuffer,
    clearRecordingBuffer,
  };
};
