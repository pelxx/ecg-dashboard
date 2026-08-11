"use client";

import type { MouseEvent } from "react";
import type { DeviceCard } from "@/types/device";
import StatusBadge from "@/components/common/StatusBadge";
import AssignmentModal from "@/components/device/AssignmentModal";

type Props = {
  readonly devices: readonly DeviceCard[];
  readonly lastDeviceActivity: Readonly<Record<string, number>>;
  readonly deviceError: string | null;
  readonly canManageAssignments: boolean;
  readonly assignmentOpen: boolean;
  readonly selectedDevice: DeviceCard | null;
  readonly onOpenDevice: (deviceKey: string) => void;
  readonly onOpenAssignment: (device: DeviceCard | null) => void;
  readonly onCloseAssignment: () => void;
};

export default function DeviceListView({
  devices,
  lastDeviceActivity,
  deviceError,
  canManageAssignments,
  assignmentOpen,
  selectedDevice,
  onOpenDevice,
  onOpenAssignment,
  onCloseAssignment,
}: Props) {
  return (
    <section className="p-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-emerald-300">Daftar Pasien</h1>
          <p className="text-sm text-slate-500">
            Pilih pasien untuk membuka monitor ECG realtime.
          </p>
        </div>

        {canManageAssignments && (
          <button
            onClick={() => onOpenAssignment(null)}
            className="w-fit rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Create Assignment
          </button>
        )}
      </div>

      {deviceError && (
        <div className="mb-4 rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
          Firebase unavailable: {deviceError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {devices.map((device) => {
          const activity = lastDeviceActivity[device.key] ?? device.lastSeen;
          const online = Boolean(activity && Date.now() - activity < 10000);

          return (
            <button
              key={device.key}
              onClick={() => onOpenDevice(device.key)}
              className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-left transition hover:border-emerald-500"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-white">
                    {device.nama}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {device.jenis_kelamin} - {device.umur} tahun
                  </p>
                  <p className="mt-2 font-mono text-xs text-slate-500">
                    {device.deviceId}
                  </p>
                </div>
                <StatusBadge
                  label={online ? "Online" : "Offline"}
                  tone={online ? "green" : "gray"}
                />
              </div>

              {canManageAssignments && (
                <span
                  onClick={(event: MouseEvent<HTMLSpanElement>) => {
                    event.stopPropagation();
                    onOpenAssignment(device);
                  }}
                  className="mt-4 inline-block rounded border border-emerald-800/40 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-950"
                >
                  Edit
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AssignmentModal
        open={assignmentOpen}
        device={selectedDevice}
        onClose={onCloseAssignment}
      />
    </section>
  );
}
