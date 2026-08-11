"use client";

import { useEffect, useState } from "react";
import { subscribeDevices } from "@/services/device.service";
import type { DeviceCard } from "@/types/device";

export type { DeviceCard } from "@/types/device";

export const useDevices = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<readonly DeviceCard[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeDevices(
      (nextDevices) => {
        setDevices(nextDevices);
        setError(null);
        setLoading(false);
      },
      (nextError) => {
        setError(nextError.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { devices, loading, error };
};
