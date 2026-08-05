"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProtectedPage from "@/components/auth/ProtectedPage";
import AppShell from "@/components/layout/AppShell";
import AssignmentModal from "@/components/devices/AssignmentModal";
import PatientInfo from "@/components/dashboard/PatientInfo";
import DeviceStatus from "@/components/dashboard/DeviceStatus";
import ControlPanel from "@/components/dashboard/ControlPanel";
import ChartSettings from "@/components/ecgGraph/ChartSettings";
import DataLogger from "@/components/dashboard/DataLogger";
import ECGCanvasSweep from "@/components/ecgGraph/ECGCanvas";
import { useAuth } from "@/hooks/useAuth";
import { useDevices, type DeviceCard } from "@/hooks/useDevices";
import { useMQTT } from "@/hooks/useMQTT";

function DevicesContent() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedKey = params.get("key");

  const { permissions, loading: authLoading } = useAuth();
  const { devices, loading } = useDevices();
  const [paperSpeed, setPaperSpeed] = useState(5000);
  const [sensitivity, setSensitivity] = useState<
    "auto" | "half" | "standard" | "double"
  >("standard");
  const [recordingStatus, setRecordingStatus] = useState<Record<string, boolean>>(
    {}
  );
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceCard | null>(null);

  const handleRecordToggle = (deviceId: string, status: boolean) => {
    setRecordingStatus((prev) => ({
      ...prev,
      [deviceId]: status,
    }));
  };

  const handleManualSave = (deviceId: string) => {
    alert(`Manual save untuk ${deviceId} bisa disambungkan ke Firebase nanti`);
  };

  const openAssignmentModal = (device: DeviceCard | null) => {
    setSelectedDevice(device);
    setAssignmentOpen(true);
  };

  const { liveEcgData, liveBPM, lastDeviceActivity } = useMQTT({
    selectedKey,
    paperSpeed,
    recordingStatus,
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-black">
        Loading...
      </div>
    );
  }

  if (!selectedKey) {
    return (
      <AppShell>
        <section className="p-6">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-bold text-blue-400">
              Daftar Pasien
            </h1>

            {permissions?.manageAssignments && (
              <button
                onClick={() => openAssignmentModal(null)}
                className="w-fit rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Create Assignment
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {devices.map((device) => (
              <div
                key={device.key}
                onClick={() => router.push(`/devices?key=${device.key}`)}
                className="cursor-pointer rounded-lg border border-gray-800 bg-gray-900 p-4 transition hover:border-blue-500"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{device.nama}</h2>
                    <p className="text-sm text-gray-400">
                      {device.jenis_kelamin} - {device.umur} tahun
                    </p>
                    <p className="mt-2 font-mono text-xs text-gray-500">
                      {device.deviceId}
                    </p>
                  </div>

                  {permissions?.manageAssignments && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        openAssignmentModal(device);
                      }}
                      className="rounded border border-blue-800/40 px-3 py-1 text-xs text-blue-200 hover:bg-blue-950"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <AssignmentModal
            open={assignmentOpen}
            device={selectedDevice}
            onClose={() => setAssignmentOpen(false)}
          />
        </section>
      </AppShell>
    );
  }

  const patient = devices.find((device) => device.key === selectedKey);
  const leads = liveEcgData[selectedKey];

  if (!patient) {
    return (
      <AppShell>
        <div className="p-6 text-white">Pasien tidak ditemukan</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-400">{patient.nama}</h1>

          <button
            onClick={() => router.push("/devices")}
            className="rounded bg-gray-800 px-3 py-1 hover:bg-gray-700"
          >
            Kembali
          </button>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex w-full flex-col gap-4 lg:w-1/3">
            <PatientInfo
              id={patient.deviceId}
              name={patient.nama}
              age={patient.umur}
              gender={patient.jenis_kelamin}
              bpm={liveBPM[selectedKey] || 0}
            />

            <ChartSettings
              currentSpeed={paperSpeed}
              onSpeedChange={setPaperSpeed}
              currentSensitivity={sensitivity}
              onSensitivityChange={(value) =>
                setSensitivity(
                  value as "auto" | "half" | "standard" | "double"
                )
              }
            />

            <DeviceStatus
              deviceId={selectedKey}
              lastActivityTimestamp={lastDeviceActivity[selectedKey] || null}
            />

            <ControlPanel
              deviceId={selectedKey}
              onRecordToggle={handleRecordToggle}
              onManualSave={handleManualSave}
              canRecord={!!permissions?.recordECG}
              canSaveSnapshot={!!permissions?.saveSnapshot}
            />
          </div>

          <div className="flex w-full flex-col gap-4 lg:w-2/3">
            <div className="rounded border border-green-700/30 bg-gray-900 p-4">
              <h2 className="mb-2 font-semibold text-green-400">
                ECG Realtime
              </h2>

              <ECGCanvasSweep
                title="Lead I"
                data={leads?.lead1 || []}
                windowMs={paperSpeed}
                sensitivity={sensitivity}
              />
              <ECGCanvasSweep
                title="Lead II"
                data={leads?.lead2 || []}
                windowMs={paperSpeed}
                sensitivity={sensitivity}
              />
              <ECGCanvasSweep
                title="Lead III"
                data={leads?.lead3 || []}
                windowMs={paperSpeed}
                sensitivity={sensitivity}
              />
            </div>

            {permissions?.viewRecordingHistory && (
              <DataLogger
                deviceId={selectedKey}
                canDownload={!!permissions.downloadRecordings}
                canDelete={!!permissions.deleteRecordings}
              />
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

export default function DevicesPage() {
  return (
    <ProtectedPage permission="viewDevices">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-white bg-black">
            Loading...
          </div>
        }
      >
        <DevicesContent />
      </Suspense>
    </ProtectedPage>
  );
}
