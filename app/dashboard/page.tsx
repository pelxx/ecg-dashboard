"use client";

import Link from "next/link";
import ProtectedPage from "@/components/auth/ProtectedPage";
import AppShell from "@/components/layout/AppShell";
import MedicalCard from "@/components/common/MedicalCard";
import StatusBadge from "@/components/common/StatusBadge";
import { useDevices } from "@/hooks/useDevices";
import { useMQTT } from "@/hooks/useMQTT";
import { DEFAULT_ECG_WINDOW_MS } from "@/constants/ecg";
import { DEVICE_OFFLINE_THRESHOLD_MS } from "@/constants/device";
import { formatTime } from "@/utils/time";

export default function DashboardPage() {
  return (
    <ProtectedPage permission="viewDashboard">
      <DashboardContent />
    </ProtectedPage>
  );
}

function DashboardContent() {
  const { devices, loading, error } = useDevices();
  const {
    liveBPM,
    lastDeviceActivity,
    connectionState,
    invalidPayloadCount,
  } = useMQTT({ paperSpeed: DEFAULT_ECG_WINDOW_MS });

  const now = Date.now();
  const onlineCount = devices.filter((device) => {
    const lastSeen = lastDeviceActivity[device.key] ?? device.lastSeen;
    return Boolean(lastSeen && now - lastSeen < DEVICE_OFFLINE_THRESHOLD_MS);
  }).length;
  const recordingCount = devices.filter((device) => device.isRecording).length;

  return (
    <AppShell>
      <section className="space-y-5 p-6">
        <div>
          <h1 className="text-3xl font-bold text-emerald-300">
            ECG Monitoring Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Realtime device, patient, and signal overview.
          </p>
        </div>

        {error && (
          <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
            Firebase unavailable: {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Devices" value={String(devices.length)} />
          <SummaryCard label="Online" value={String(onlineCount)} tone="green" />
          <SummaryCard
            label="Recording"
            value={String(recordingCount)}
            tone={recordingCount > 0 ? "red" : "gray"}
          />
          <SummaryCard
            label="MQTT"
            value={connectionState.status}
            tone={connectionState.connected ? "green" : "yellow"}
          />
        </div>

        <MedicalCard
          title="Live Patients"
          action={
            <StatusBadge
              label={`${invalidPayloadCount} invalid payloads`}
              tone={invalidPayloadCount > 0 ? "yellow" : "gray"}
            />
          }
        >
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Loading...</p>
          ) : devices.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              Belum ada patient assignment.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-2 font-medium">Patient</th>
                    <th className="py-2 font-medium">Device</th>
                    <th className="py-2 font-medium">BPM</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Last Seen</th>
                    <th className="py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {devices.map((device) => {
                    const lastSeen = lastDeviceActivity[device.key] ?? device.lastSeen;
                    const online = Boolean(
                      lastSeen && now - lastSeen < DEVICE_OFFLINE_THRESHOLD_MS
                    );

                    return (
                      <tr key={device.key} className="text-slate-200">
                        <td className="py-3">
                          <p className="font-medium text-white">{device.nama}</p>
                          <p className="text-xs text-slate-500">
                            {device.jenis_kelamin} - {device.umur} years
                          </p>
                        </td>
                        <td className="py-3 font-mono text-xs text-slate-400">
                          {device.deviceId}
                        </td>
                        <td className="py-3 text-emerald-300">
                          {liveBPM[device.key] || "--"}
                        </td>
                        <td className="py-3">
                          <StatusBadge
                            label={online ? "Online" : "Offline"}
                            tone={online ? "green" : "gray"}
                          />
                        </td>
                        <td className="py-3 text-slate-400">
                          {formatTime(lastSeen)}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            href={`/devices?key=${device.key}`}
                            className="rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                          >
                            Open Monitor
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </MedicalCard>
      </section>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  tone = "blue",
}: {
  readonly label: string;
  readonly value: string;
  readonly tone?: "green" | "yellow" | "red" | "gray" | "blue";
}) {
  return (
    <MedicalCard title={label} action={<StatusBadge label={label} tone={tone} />}>
      <p className="text-3xl font-bold text-white capitalize">{value}</p>
    </MedicalCard>
  );
}
