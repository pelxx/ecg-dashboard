"use client";

import Link from "next/link";
import ProtectedPage from "@/components/auth/ProtectedPage";
import AppShell from "@/components/layout/AppShell";
import MedicalCard from "@/components/common/MedicalCard";
import StatusBadge from "@/components/common/StatusBadge";
import { useDevices } from "@/hooks/useDevices";
import { useRealtimeMQTT } from "@/components/realtime/MQTTProvider";
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
  } = useRealtimeMQTT();

  const now = Date.now();

  const onlineCount = devices.filter((device) => {
    const lastSeen = lastDeviceActivity[device.key] ?? device.lastSeen;
    return Boolean(
      lastSeen && now - lastSeen < DEVICE_OFFLINE_THRESHOLD_MS
    );
  }).length;

  const recordingCount = devices.filter(
    (device) => device.isRecording
  ).length;

  return (
    <AppShell>
      <section className="space-y-5 p-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">
            Pemantauan ECG 
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Realtime device, patient, and signal overview.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-[var(--danger)] bg-[var(--surface)] p-3 text-sm text-[var(--danger)]">
            Firebase unavailable: {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Devices"
            value={String(devices.length)}
          />
          <SummaryCard
            label="Online"
            value={String(onlineCount)}
            tone="green"
          />
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
            <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
              Loading...
            </p>
          ) : devices.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
              Belum ada patient assignment.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm text-[var(--foreground)]">
                <thead className="border-b border-[var(--border)] text-left text-[var(--text-secondary)]">
                  <tr>
                    <th className="py-3 font-medium">Patient</th>
                    <th className="py-3 font-medium">Device</th>
                    <th className="py-3 font-medium">BPM</th>
                    <th className="py-3 font-medium">Status</th>
                    <th className="py-3 font-medium">Last Seen</th>
                    <th className="py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--border)]">
                  {devices.map((device) => {
                    const lastSeen =
                      lastDeviceActivity[device.key] ?? device.lastSeen;

                    const online = Boolean(
                      lastSeen &&
                        now - lastSeen < DEVICE_OFFLINE_THRESHOLD_MS
                    );

                    return (
                      <tr
                        key={device.key}
                        className="transition-colors hover:bg-[var(--surface-secondary)]"
                      >
                        <td className="py-3 pr-3">
                          <p className="font-medium text-[var(--foreground)]">
                            {device.nama}
                          </p>
                          <p className="mt-1 text-xs text-[var(--text-secondary)]">
                            {device.jenis_kelamin} - {device.umur} years
                          </p>
                        </td>

                        <td className="py-3 pr-3 font-mono text-xs text-[var(--text-secondary)]">
                          {device.deviceId}
                        </td>

                        <td className="py-3 pr-3 font-semibold text-[var(--success)]">
                          {liveBPM[device.key] || "--"}
                        </td>

                        <td className="py-3 pr-3">
                          <StatusBadge
                            label={online ? "Online" : "Offline"}
                            tone={online ? "green" : "gray"}
                          />
                        </td>

                        <td className="py-3 pr-3 text-[var(--text-secondary)]">
                          {formatTime(lastSeen)}
                        </td>

                        <td className="py-3 text-right">
                          <Link
                            href={`/devices?key=${device.key}`}
                            className="inline-flex items-center justify-center rounded-md bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
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
    <MedicalCard
      title={label}
      action={<StatusBadge label={label} tone={tone} />}
    >
      <p className="text-3xl font-bold capitalize text-[var(--foreground)]">
        {value}
      </p>
    </MedicalCard>
  );
}
