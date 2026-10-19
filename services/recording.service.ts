import {
  equalTo,
  get,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  set,
  update,
} from "firebase/database";
import { rtdb } from "@/lib/firebase";
import type { ECGDataPoint } from "@/types/ecg";
import type { RawEcgRecordData } from "@/utils/csv";

export interface RecordingItem {
  readonly key: string;
  readonly createdAt: number;
  readonly note: string;
  readonly deviceId: string;
  readonly durationMs?: number;
  readonly sampleCount?: number;
  readonly sampleRateHz?: number;
}

export interface RecordingSession {
  readonly key: string;
  readonly deviceId: string;
  readonly createdAt: number;
}

export interface RecordingChunk {
  readonly startMillis: number;
  readonly sampleIntervalMs: number;
  readonly lead1: readonly ECGDataPoint[];
  readonly lead2: readonly ECGDataPoint[];
  readonly lead3: readonly ECGDataPoint[];
}

export interface RecordingSummary {
  readonly startMillis: number;
  readonly endMillis: number;
  readonly sampleCount: number;
  readonly sampleIntervalMs: number | null;
}

export interface DeviceRecordingStatus {
  readonly isRecording: boolean;
  readonly recordKey?: string;
}

type RawRecording = Omit<RecordingItem, "key">;
type RawDeviceRecordingStatus = {
  readonly isRecording?: unknown;
  readonly recordingKey?: unknown;
};
type LeadPoints = Pick<RecordingChunk, "lead1" | "lead2" | "lead3">;

export type RecordingWithData = RecordingItem & {
  readonly data: RawEcgRecordData;
};

const getTiming = (points: LeadPoints): RecordingSummary | null => {
  const leads = [points.lead1, points.lead2, points.lead3];
  let startMillis = Number.POSITIVE_INFINITY;
  let endMillis = Number.NEGATIVE_INFINITY;
  let sampleIntervalMs = Number.POSITIVE_INFINITY;

  for (const lead of leads) {
    const firstPoint = lead[0];
    const lastPoint = lead[lead.length - 1];
    if (!firstPoint || !lastPoint) continue;

    startMillis = Math.min(startMillis, firstPoint.timestamp);
    endMillis = Math.max(endMillis, lastPoint.timestamp);
    if (lead.length > 1) {
      const interval = lead[1].timestamp - firstPoint.timestamp;
      if (interval > 0) sampleIntervalMs = Math.min(sampleIntervalMs, interval);
    }
  }

  if (!Number.isFinite(startMillis) || !Number.isFinite(endMillis)) return null;
  return {
    startMillis,
    endMillis,
    sampleIntervalMs: Number.isFinite(sampleIntervalMs) ? sampleIntervalMs : null,
    sampleCount: Math.max(
      points.lead1.length,
      points.lead2.length,
      points.lead3.length
    ),
  };
};

const toRawChunk = (chunk: RecordingChunk): RawEcgRecordData[string] => ({
  lead1: chunk.lead1.map((point) => point.value),
  lead2: chunk.lead2.map((point) => point.value),
  lead3: chunk.lead3.map((point) => point.value),
  sampleIntervalMs: chunk.sampleIntervalMs,
});

const mapRecordings = (data: Record<string, RawRecording>): RecordingItem[] =>
  Object.entries(data)
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.createdAt - a.createdAt);

export const subscribeDeviceRecordings = (
  deviceId: string,
  onRecords: (records: readonly RecordingItem[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const recordsRef = ref(rtdb, "records");
  const deviceQuery = query(recordsRef, orderByChild("deviceId"), equalTo(deviceId));
  return onValue(
    deviceQuery,
    (snapshot) => onRecords(mapRecordings((snapshot.val() || {}) as Record<string, RawRecording>)),
    (error) => onError?.(error)
  );
};

export const subscribeAllRecordings = (
  onRecords: (records: readonly RecordingItem[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const recordsRef = ref(rtdb, "records");
  return onValue(
    recordsRef,
    (snapshot) => onRecords(mapRecordings((snapshot.val() || {}) as Record<string, RawRecording>)),
    (error) => onError?.(error)
  );
};

export const subscribeRecordingStatus = (
  deviceId: string,
  onStatus: (isRecording: boolean) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const recordingRef = ref(rtdb, `devices/${deviceId}/isRecording`);
  return onValue(
    recordingRef,
    (snapshot) => onStatus(snapshot.val() === true),
    (error) => onError?.(error)
  );
};

export const subscribeRecordingStatuses = (
  onStatuses: (statuses: Readonly<Record<string, DeviceRecordingStatus>>) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const devicesRef = ref(rtdb, "devices");
  return onValue(
    devicesRef,
    (snapshot) => {
      const devices = (snapshot.val() || {}) as Record<string, RawDeviceRecordingStatus>;
      onStatuses(
        Object.fromEntries(
          Object.entries(devices).map(([deviceId, device]) => [
            deviceId,
            {
              isRecording: device.isRecording === true,
              recordKey: typeof device.recordingKey === "string" ? device.recordingKey : undefined,
            },
          ])
        )
      );
    },
    (error) => onError?.(error)
  );
};

export const setRecordingStatus = async (
  deviceId: string,
  isRecording: boolean
): Promise<void> => {
  await update(ref(rtdb, `devices/${deviceId}`), {
    isRecording,
    ...(isRecording ? {} : { recordingKey: null }),
  });
};

export const createRecordingSession = async (deviceId: string): Promise<RecordingSession> => {
  const recordRef = push(ref(rtdb, "records"));
  if (!recordRef.key) throw new Error("Failed to create recording.");

  const session: RecordingSession = { key: recordRef.key, deviceId, createdAt: Date.now() };
  await update(ref(rtdb), {
    [`records/${session.key}`]: {
      createdAt: session.createdAt,
      note: "ECG Recording",
      deviceId,
      durationMs: 0,
      sampleCount: 0,
      data: {},
    },
    [`devices/${deviceId}/isRecording`]: true,
    [`devices/${deviceId}/recordingKey`]: session.key,
  });
  return session;
};

export const appendRecordingChunk = async (
  session: RecordingSession,
  chunk: RecordingChunk
): Promise<void> => {
  const timing = getTiming(chunk);
  if (!timing || timing.sampleCount === 0) return;

  await update(ref(rtdb, `records/${session.key}`), {
    [`data/${Math.round(chunk.startMillis)}`]: toRawChunk(chunk),
    updatedAt: Date.now(),
  });
};

export const finishRecordingSession = async (
  session: RecordingSession,
  summary: RecordingSummary | null
): Promise<void> => {
  const durationMs = summary?.sampleIntervalMs
    ? Math.max(0, summary.endMillis - summary.startMillis + summary.sampleIntervalMs)
    : 0;
  await update(ref(rtdb), {
    [`records/${session.key}/durationMs`]: durationMs,
    [`records/${session.key}/sampleCount`]: summary?.sampleCount ?? 0,
    [`records/${session.key}/sampleRateHz`]: summary?.sampleIntervalMs
      ? 1000 / summary.sampleIntervalMs
      : null,
    [`records/${session.key}/updatedAt`]: Date.now(),
    [`devices/${session.deviceId}/isRecording`]: false,
    [`devices/${session.deviceId}/recordingKey`]: null,
  });
};

export const deleteRecording = async (recordKey: string): Promise<void> => {
  await remove(ref(rtdb, `records/${recordKey}`));
};

export const getRecordingData = async (recordKey: string): Promise<RawEcgRecordData | null> => {
  const snapshot = await get(ref(rtdb, `records/${recordKey}/data`));
  return snapshot.exists() ? (snapshot.val() as RawEcgRecordData) : null;
};

export const getRecording = async (recordKey: string): Promise<RecordingWithData | null> => {
  const snapshot = await get(ref(rtdb, `records/${recordKey}`));
  if (!snapshot.exists()) return null;

  const value = snapshot.val() as RawRecording & { readonly data?: RawEcgRecordData };
  return {
    key: recordKey,
    createdAt: value.createdAt,
    note: value.note,
    deviceId: value.deviceId,
    durationMs: value.durationMs,
    sampleCount: value.sampleCount,
    sampleRateHz: value.sampleRateHz,
    data: value.data ?? {},
  };
};

export const saveSnapshot = async (deviceId: string, snapshot: LeadPoints): Promise<void> => {
  const timing = getTiming(snapshot);
  if (!timing || timing.sampleIntervalMs === null) {
    throw new Error("Cannot infer the snapshot sample interval.");
  }

  const recordRef = push(ref(rtdb, "records"));
  if (!recordRef.key) throw new Error("Failed to create snapshot record.");

  const chunk: RecordingChunk = {
    startMillis: timing.startMillis,
    sampleIntervalMs: timing.sampleIntervalMs,
    ...snapshot,
  };
  await set(recordRef, {
    createdAt: Date.now(),
    note: "Manual Snapshot",
    deviceId,
    durationMs: Math.max(0, timing.endMillis - timing.startMillis + timing.sampleIntervalMs),
    sampleRateHz: 1000 / timing.sampleIntervalMs,
    sampleCount: timing.sampleCount,
    data: { [String(Math.round(timing.startMillis))]: toRawChunk(chunk) },
  });
};

export const saveRecording = async (
  deviceId: string,
  recording: LeadPoints & { readonly startTime: number }
): Promise<void> => {
  await saveSnapshot(deviceId, recording);
};
