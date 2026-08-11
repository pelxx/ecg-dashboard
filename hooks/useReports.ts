"use client";

import { useEffect, useState } from "react";
import {
  subscribeAllRecordings,
  type RecordingItem,
} from "@/services/recording.service";

export function useReports() {
  const [records, setRecords] = useState<RecordingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeAllRecordings(
      (items) => {
        setRecords([...items]);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return {
    records,
    loading,
    error,
  };
}
