"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteRecording,
  getRecordingData,
  setRecordingStatus,
  subscribeDeviceRecordings,
  subscribeRecordingStatus,
  type RecordingItem,
} from "@/services/recording.service";

export const useRecordingStatus = (deviceId: string) => {
  const [isRecording, setIsRecordingState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeRecordingStatus(
      deviceId,
      (status) => {
        setIsRecordingState(status);
        setError(null);
        setLoading(false);
      },
      (nextError) => {
        setError(nextError.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [deviceId]);

  const updateRecordingStatus = useCallback(
    async (nextStatus: boolean) => {
      await setRecordingStatus(deviceId, nextStatus);
    },
    [deviceId]
  );

  return { isRecording, loading, error, updateRecordingStatus };
};

export const useRecordings = (deviceId: string) => {
  const [records, setRecords] = useState<readonly RecordingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeDeviceRecordings(
      deviceId,
      (nextRecords) => {
        setRecords(nextRecords);
        setError(null);
        setLoading(false);
      },
      (nextError) => {
        setError(nextError.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [deviceId]);

  return {
    records,
    loading,
    error,
    deleteRecording,
    getRecordingData,
  };
};
