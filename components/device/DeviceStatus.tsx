"use client";

import { memo, useEffect, useState } from "react";
import MedicalCard from "@/components/common/MedicalCard";
import StatusBadge from "@/components/common/StatusBadge";
import { DEVICE_OFFLINE_THRESHOLD_MS } from "@/constants/device";
import type { DeviceTelemetry } from "@/types/device";
import { formatTime } from "@/utils/time";

type Props = {
  readonly deviceId: string;
  readonly mqttConnected: boolean;
  readonly telemetry: DeviceTelemetry;
  readonly lastActivityTimestamp: number | null;
};

const DeviceStatus = memo(function DeviceStatus({
  deviceId,
  mqttConnected,
  telemetry,
  lastActivityTimestamp,
}: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 2000);
    return () => window.clearInterval(timer);
  }, []);

  const lastSeen = telemetry.lastSeen ?? lastActivityTimestamp;
  const online = Boolean(lastSeen && now - lastSeen < DEVICE_OFFLINE_THRESHOLD_MS);
  const streaming = telemetry.streaming ?? online;

  const rows = [
    ["Device ID", deviceId],
    ["MQTT Connected", mqttConnected ? "Yes" : "No"],
    ["Last Seen", formatTime(lastSeen)],
    ["Streaming", streaming ? "Active" : "Stopped"],
  ] as const;

  return (
    <MedicalCard
      title="Device Status"
      action={
        <StatusBadge
          label={online ? "Online" : "Offline"}
          tone={online ? "green" : "red"}
        />
      }
    >
      <div className="mb-3 flex items-center gap-3">
        <span
          className={`h-3 w-3 rounded-full ${
            online ? "bg-emerald-400 shadow-[0_0_12px_#34d399]" : "bg-slate-600"
          }`}
        />
        <div>
          <p className="text-sm text-slate-200">
            {streaming ? "ECG stream active" : "ECG stream stopped"}
          </p>
          <p className="text-xs text-slate-500">
            {mqttConnected ? "MQTT broker connected" : "MQTT broker disconnected"}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-slate-500">{label}</dt>
            <dd className="min-w-0 truncate text-right text-slate-100">{value}</dd>
          </div>
        ))}
      </dl>
    </MedicalCard>
  );
});

export default DeviceStatus;
