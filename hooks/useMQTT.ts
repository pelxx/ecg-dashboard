"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { DEFAULT_ECG_WINDOW_MS, ECG_SAMPLE_RATE_HZ } from "@/constants/ecg";
import { CircularBuffer } from "@/components/ecg/buffer/CircularBuffer";
import { MQTT_BROKER_URL, MQTT_TOPICS } from "@/constants/mqtt";
import {
  appendRecordingChunk,
  createRecordingSession,
  finishRecordingSession,
  setRecordingStatus,
  subscribeRecordingStatuses,
  type DeviceRecordingStatus,
  type RecordingChunk,
  type RecordingSession,
  type RecordingSummary,
} from "@/services/recording.service";
import { MQTTService, createDefaultECGPoint } from "@/services/mqtt.service";
import type { ECGDataPoint, ECGLeadKey, ECGLeadSeries, ParsedECGPacket } from "@/types/ecg";
import type { MQTTConnectionState, MQTTDeviceStatus } from "@/types/mqtt";

type AllLeadsData = Record<string, ECGLeadSeries>;
type DeviceBuffers = Record<ECGLeadKey, CircularBuffer<ECGDataPoint>>;
type RecordingRuntime = {
  readonly session: RecordingSession;
  chunk: RecordingChunk | null;
  summary: RecordingSummary | null;
};

type UseMQTTOptions = {
  readonly paperSpeed: number;
  readonly enabled?: boolean;
};

const RECORDING_FLUSH_MS = 5000;
const emptySeries: ECGLeadSeries = { lead1: [], lead2: [], lead3: [] };
const initialConnectionState: MQTTConnectionState = {
  status: "idle",
  connected: false,
  error: null,
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
    return { timestamp, value:value/1000 };
  });
};

const hasChunkSamples = (chunk: RecordingChunk | null): chunk is RecordingChunk =>
  Boolean(chunk && (chunk.lead1.length || chunk.lead2.length || chunk.lead3.length));

const makeChunk = (
  packet: ParsedECGPacket,
  lead1: readonly ECGDataPoint[],
  lead2: readonly ECGDataPoint[],
  lead3: readonly ECGDataPoint[]
): RecordingChunk => ({
  startMillis:
    lead1[0]?.timestamp ??
    lead2[0]?.timestamp ??
    lead3[0]?.timestamp ??
    packet.startMillis,
  sampleIntervalMs: packet.sampleIntervalMs,
  lead1,
  lead2,
  lead3,
});

const mergeSummary = (
  previous: RecordingSummary | null,
  chunk: RecordingChunk
): RecordingSummary | null => {
  const points = [chunk.lead1, chunk.lead2, chunk.lead3];
  const first = Math.min(
    ...points.map((lead) => lead[0]?.timestamp ?? Number.POSITIVE_INFINITY)
  );
  const last = Math.max(
    ...points.map((lead) => lead[lead.length - 1]?.timestamp ?? Number.NEGATIVE_INFINITY)
  );
  const count = Math.max(...points.map((lead) => lead.length));
  if (!Number.isFinite(first) || !Number.isFinite(last) || count === 0) return previous;

  return {
    startMillis: previous ? Math.min(previous.startMillis, first) : first,
    endMillis: previous ? Math.max(previous.endMillis, last) : last,
    sampleIntervalMs: chunk.sampleIntervalMs,
    sampleCount: (previous?.sampleCount ?? 0) + count,
  };
};

export const useMQTT = ({ paperSpeed, enabled = true }: UseMQTTOptions) => {
  const [liveEcgData, setLiveEcgData] = useState<AllLeadsData>({});
  const [liveBPM, setLiveBPM] = useState<Record<string, number>>({});
  const [lastDeviceActivity, setLastDeviceActivity] = useState<Record<string, number>>({});
  const [connectionState, setConnectionState] = useState<MQTTConnectionState>(initialConnectionState);
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, MQTTDeviceStatus>>({});
  const [recordingStatuses, setRecordingStatuses] = useState<Readonly<Record<string, DeviceRecordingStatus>>>({});
  const [invalidPayloadCount, setInvalidPayloadCount] = useState(0);
  const [droppedPacketCount, setDroppedPacketCount] = useState<Record<string, number>>({});
  const [deviceRebootCount, setDeviceRebootCount] = useState<Record<string, number>>({});

  const serviceRef = useRef<MQTTService | null>(null);
  const buffersRef = useRef<Record<string, DeviceBuffers>>({});
  const recordingStatusesRef = useRef<Readonly<Record<string, DeviceRecordingStatus>>>({});
  const recordingRuntimesRef = useRef<Record<string, RecordingRuntime>>({});
  const writeQueuesRef = useRef<Record<string, Promise<void>>>({});
  const lastTimestampRef = useRef<Record<string, number>>({});
  const sequenceRef = useRef<Record<string, { sequence: number; startMillis: number }>>({});
  const capacityRef = useRef(Math.ceil((DEFAULT_ECG_WINDOW_MS / 1000) * ECG_SAMPLE_RATE_HZ));

  useEffect(() => {
    capacityRef.current = Math.max(
      ECG_SAMPLE_RATE_HZ,
      Math.ceil((paperSpeed / 1000) * ECG_SAMPLE_RATE_HZ)
    );
    for (const deviceId of Object.keys(buffersRef.current)) {
      buffersRef.current[deviceId] = createDeviceBuffers(capacityRef.current);
    }
  }, [paperSpeed]);

  const enqueueWrite = useCallback((deviceId: string, write: () => Promise<void>) => {
    const previous = writeQueuesRef.current[deviceId] ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(write);
    writeQueuesRef.current[deviceId] = next;
    return next;
  }, []);

  const flushRecordingChunk = useCallback(async (deviceId: string) => {
    const runtime = recordingRuntimesRef.current[deviceId];
    if (!runtime || !hasChunkSamples(runtime.chunk)) return;

    const chunk = runtime.chunk;
    runtime.chunk = null;
    await enqueueWrite(deviceId, () => appendRecordingChunk(runtime.session, chunk));
  }, [enqueueWrite]);

  const startRecording = useCallback(async (deviceId: string) => {
    const session = await createRecordingSession(deviceId);
    recordingRuntimesRef.current[deviceId] = { session, chunk: null, summary: null };
    const nextStatus = { ...recordingStatusesRef.current, [deviceId]: { isRecording: true, recordKey: session.key } };
    recordingStatusesRef.current = nextStatus;
    setRecordingStatuses(nextStatus);
  }, []);

  const stopRecording = useCallback(async (deviceId: string) => {
    const current = recordingStatusesRef.current[deviceId];
    const runtime = recordingRuntimesRef.current[deviceId] ??
      (current?.recordKey
        ? {
            session: { key: current.recordKey, deviceId, createdAt: Date.now() },
            chunk: null,
            summary: null,
          }
        : null);
    const nextStatus = { ...recordingStatusesRef.current, [deviceId]: { ...current, isRecording: false } };
    recordingStatusesRef.current = nextStatus;
    setRecordingStatuses(nextStatus);

    await setRecordingStatus(deviceId, false);
    if (!runtime) return;
    await flushRecordingChunk(deviceId);
    await (writeQueuesRef.current[deviceId] ?? Promise.resolve());
    await finishRecordingSession(runtime.session, runtime.summary);
    delete recordingRuntimesRef.current[deviceId];
  }, [flushRecordingChunk]);

  const flushRecordings = useCallback(async () => {
    await Promise.all(Object.keys(recordingRuntimesRef.current).map(flushRecordingChunk));
    await Promise.all(Object.values(writeQueuesRef.current));
  }, [flushRecordingChunk]);

  useEffect(() => {
    if (!enabled) {
      recordingStatusesRef.current = {};
      setRecordingStatuses({});
      return;
    }

    return subscribeRecordingStatuses((statuses) => {
      recordingStatusesRef.current = statuses;
      setRecordingStatuses(statuses);
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      serviceRef.current?.cleanup();
      serviceRef.current = null;
      setConnectionState(initialConnectionState);
      return;
    }

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
          setDeviceStatuses((previous) => ({ ...previous, [event.status.deviceId]: event.status }));
          setLastDeviceActivity((previous) => ({ ...previous, [event.status.deviceId]: event.status.lastSeen }));
          return;
        }

        const { packet } = event;
        const chunkSequence = packet.chunkSeq;
        const sequenceState = sequenceRef.current[packet.deviceId];
        if (chunkSequence !== null && sequenceState) {
          const rebooted = chunkSequence === 0 && packet.startMillis > sequenceState.startMillis;
          if (rebooted) {
            setDeviceRebootCount((previous) => ({ ...previous, [packet.deviceId]: (previous[packet.deviceId] ?? 0) + 1 }));
          } else if (chunkSequence <= sequenceState.sequence) {
            setDroppedPacketCount((previous) => ({ ...previous, [packet.deviceId]: (previous[packet.deviceId] ?? 0) + 1 }));
            return;
          } else if (chunkSequence > sequenceState.sequence + 1) {
            setDroppedPacketCount((previous) => ({
              ...previous,
              [packet.deviceId]: (previous[packet.deviceId] ?? 0) + chunkSequence - sequenceState.sequence - 1,
            }));
          }
        }
        if (chunkSequence !== null) {
          sequenceRef.current[packet.deviceId] = { sequence: chunkSequence, startMillis: packet.startMillis };
        }

        if (!buffersRef.current[packet.deviceId]) {
          buffersRef.current[packet.deviceId] = createDeviceBuffers(capacityRef.current);
        }
        const lead1 = mapToPoints(packet.lead1, packet.startMillis, packet.sampleIntervalMs, `${packet.deviceId}:lead1`, lastTimestampRef);
        const lead2 = mapToPoints(packet.lead2, packet.startMillis, packet.sampleIntervalMs, `${packet.deviceId}:lead2`, lastTimestampRef);
        const lead3 = mapToPoints(packet.lead3, packet.startMillis, packet.sampleIntervalMs, `${packet.deviceId}:lead3`, lastTimestampRef);
        const buffers = buffersRef.current[packet.deviceId];
        buffers.lead1.pushChunk(lead1);
        buffers.lead2.pushChunk(lead2);
        buffers.lead3.pushChunk(lead3);

        const status = recordingStatusesRef.current[packet.deviceId];
        if (status?.isRecording && status.recordKey) {
          let runtime = recordingRuntimesRef.current[packet.deviceId];
          if (!runtime || runtime.session.key !== status.recordKey) {
            runtime = {
              session: { key: status.recordKey, deviceId: packet.deviceId, createdAt: Date.now() },
              chunk: null,
              summary: null,
            };
            recordingRuntimesRef.current[packet.deviceId] = runtime;
          }

          const nextChunk = makeChunk(packet, lead1, lead2, lead3);
          if (runtime.chunk && runtime.chunk.sampleIntervalMs !== nextChunk.sampleIntervalMs) {
            const previousChunk = runtime.chunk;
            runtime.chunk = nextChunk;
            void enqueueWrite(packet.deviceId, () =>
              appendRecordingChunk(runtime.session, previousChunk)
            );
          } else if (!runtime.chunk) {
            runtime.chunk = nextChunk;
          } else {
            runtime.chunk = {
              ...runtime.chunk,
              lead1: [...runtime.chunk.lead1, ...nextChunk.lead1],
              lead2: [...runtime.chunk.lead2, ...nextChunk.lead2],
              lead3: [...runtime.chunk.lead3, ...nextChunk.lead3],
            };
          }
          runtime.summary = mergeSummary(runtime.summary, nextChunk);
          if (runtime.chunk && packet.startMillis - runtime.chunk.startMillis >= RECORDING_FLUSH_MS) {
            void flushRecordingChunk(packet.deviceId);
          }
        }

        if (packet.bpm !== null) setLiveBPM((previous) => ({ ...previous, [packet.deviceId]: packet.bpm ?? 0 }));
        setLastDeviceActivity((previous) => ({ ...previous, [packet.deviceId]: packet.receivedAt }));
      },
    });

    return () => {
      service.cleanup();
      serviceRef.current = null;
    };
  }, [enabled, enqueueWrite, flushRecordingChunk]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLiveEcgData(() => Object.fromEntries(
        Object.entries(buffersRef.current).map(([deviceId, buffers]) => [
          deviceId,
          { lead1: buffers.lead1.snapshot(), lead2: buffers.lead2.snapshot(), lead3: buffers.lead3.snapshot() },
        ])
      ));
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
    setLiveEcgData((previous) => (deviceId ? { ...previous, [deviceId]: emptySeries } : {}));
  }, []);

  const reconnectMQTT = useCallback(() => serviceRef.current?.reconnect(), []);
  const publish = useCallback((topic: string, payload: unknown) => serviceRef.current?.publish(topic, payload), []);
  const getBufferSnapshot = useCallback((deviceId: string) => {
    const buffers = buffersRef.current[deviceId];
    return buffers ? { lead1: buffers.lead1.snapshot(), lead2: buffers.lead2.snapshot(), lead3: buffers.lead3.snapshot() } : null;
  }, []);

  return {
    liveEcgData,
    liveBPM,
    lastDeviceActivity,
    connectionState,
    deviceStatuses,
    recordingStatuses,
    invalidPayloadCount,
    droppedPacketCount,
    deviceRebootCount,
    clearBuffer,
    reconnectMQTT,
    publish,
    getBufferSnapshot,
    startRecording,
    stopRecording,
    flushRecordings,
  };
};
