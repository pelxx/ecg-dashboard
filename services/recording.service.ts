
import {
  equalTo,
  get,
  off,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  set,
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

type RawRecording = Omit<RecordingItem, "key">;
export type RecordingWithData = RecordingItem & {
  readonly data: RawEcgRecordData;
};

export const subscribeDeviceRecordings = (
  deviceId: string,
  onRecords: (records: readonly RecordingItem[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const recordsRef = ref(rtdb, "records");
  const deviceQuery = query(recordsRef, orderByChild("deviceId"), equalTo(deviceId));

  const unsubscribe = onValue(
    deviceQuery,
    (snapshot) => {
      const data = (snapshot.val() || {}) as Record<string, RawRecording>;
      const records = Object.entries(data)
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => b.createdAt - a.createdAt);

      onRecords(records);
    },
    (error) => onError?.(error)
  );

  return () => off(deviceQuery, "value", unsubscribe);
};

export const subscribeAllRecordings = (
  onRecords: (records: readonly RecordingItem[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const recordsRef = ref(rtdb, "records");

  const unsubscribe = onValue(
    recordsRef,
    (snapshot) => {
      const data = (snapshot.val() || {}) as Record<string, RawRecording>;

      const records = Object.entries(data)
        .map(([key, value]) => ({
          key,
          ...value,
        }))
        .sort((a, b) => b.createdAt - a.createdAt);

      onRecords(records);
    },
    (error) => onError?.(error)
  );

  return () => off(recordsRef, "value", unsubscribe);
};

export const subscribeRecordingStatus = (
  deviceId: string,
  onStatus: (isRecording: boolean) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const recordingRef = ref(rtdb, `devices/${deviceId}/isRecording`);
  const unsubscribe = onValue(
    recordingRef,
    (snapshot) => onStatus(Boolean(snapshot.val())),
    (error) => onError?.(error)
  );

  return () => off(recordingRef, "value", unsubscribe);
};

export const setRecordingStatus = async (
  deviceId: string,
  isRecording: boolean
): Promise<void> => {
  await set(ref(rtdb, `devices/${deviceId}/isRecording`), isRecording);
};

export const deleteRecording = async (recordKey: string): Promise<void> => {
  await remove(ref(rtdb, `records/${recordKey}`));
};

export const getRecordingData = async (
  recordKey: string
): Promise<RawEcgRecordData | null> => {
  const snapshot = await get(ref(rtdb, `records/${recordKey}/data`));
  if (!snapshot.exists()) return null;

  return snapshot.val() as RawEcgRecordData;
};

export const getRecording = async (
  recordKey: string
): Promise<RecordingWithData | null> => {
  const snapshot = await get(ref(rtdb, `records/${recordKey}`));

  if (!snapshot.exists()) {
    return null;
  }

  const value = snapshot.val() as RawRecording & {
    readonly data?: RawEcgRecordData;
  };

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

export const saveSnapshot = async (
  deviceId: string,
  snapshot: {
    lead1: readonly ECGDataPoint[];
    lead2: readonly ECGDataPoint[];
    lead3: readonly ECGDataPoint[];
  }
): Promise<void> => {
  const recordRef = push(ref(rtdb, "records"));

  if (!recordRef.key) {
    throw new Error("Failed to create snapshot record.");
  }

  const startTimestamp =
    snapshot.lead1[0]?.timestamp ??
    snapshot.lead2[0]?.timestamp ??
    snapshot.lead3[0]?.timestamp ??
    Date.now();

  const data: RawEcgRecordData = {
    [String(startTimestamp)]: {
      lead1: snapshot.lead1.map((point) => point.value),
      lead2: snapshot.lead2.map((point) => point.value),
      lead3: snapshot.lead3.map((point) => point.value),
      sampleIntervalMs: 4,
    },
  };

  await set(recordRef, {
    createdAt: Date.now(),
    note: "Manual Snapshot",
    deviceId,
    durationMs: 0,
    sampleRateHz: 250,
    sampleCount: Math.max(
      snapshot.lead1.length,
      snapshot.lead2.length,
      snapshot.lead3.length
    ),
    data,
  });
};

export const saveRecording = async (
  deviceId: string,
  recording: {
    startTime: number;
    lead1: readonly ECGDataPoint[];
    lead2: readonly ECGDataPoint[];
    lead3: readonly ECGDataPoint[];
  }
): Promise<void> => {
  const recordRef = push(ref(rtdb, "records"));

  if (!recordRef.key) {
    throw new Error("Failed to create recording.");
  }

  const sampleCount = Math.max(
    recording.lead1.length,
    recording.lead2.length,
    recording.lead3.length
  );

  const data: RawEcgRecordData = {
    [String(recording.startTime)]: {
      lead1: recording.lead1.map((p) => p.value),
      lead2: recording.lead2.map((p) => p.value),
      lead3: recording.lead3.map((p) => p.value),
      sampleIntervalMs: 4,
    },
  };

  await set(recordRef, {
    createdAt: Date.now(),
    note: "ECG Recording",
    deviceId,
    durationMs: sampleCount * 4,
    sampleRateHz: 250,
    sampleCount,
    data,
  });
};
