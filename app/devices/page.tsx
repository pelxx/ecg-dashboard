"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProtectedPage from "@/components/auth/ProtectedPage";
import AppShell from "@/components/layout/AppShell";
import DeviceListView from "@/components/dashboard/DeviceListView";
import DeviceMonitorView from "@/components/dashboard/DeviceMonitorView";
import { DEFAULT_LEAD_VISIBILITY } from "@/constants/ecg";
import { useAuth } from "@/hooks/useAuth";
import { useDevices, type DeviceCard } from "@/hooks/useDevices";
import { useMQTT } from "@/hooks/useMQTT";
import type { DeviceTelemetry } from "@/types/device";
import type { ECGChartSettings, ECGLeadKey, ECGSensitivity } from "@/types/ecg";
import { saveSnapshot,saveRecording } from "@/services/recording.service";

function DevicesContent() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedKey = params.get("key");
  

  const { permissions, loading: authLoading } = useAuth();
  const { devices, loading, error: deviceError } = useDevices();
  const [chartSettings, setChartSettings] = useState<ECGChartSettings>({
    windowMs: 5000,
    sensitivity: "standard",
    autoScale: false,
    frozen: false,
    showGrid: true,
    visibleLeads: DEFAULT_LEAD_VISIBILITY,
  });
  const [recordingStatus, setRecordingStatus] = useState<Record<string, boolean>>(
    {}
  );
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceCard | null>(null);

  const {
    liveEcgData,
    liveBPM,
    lastDeviceActivity,
    connectionState,
    deviceStatuses,
    invalidPayloadCount,
    clearBuffer,
    reconnectMQTT,
    publish,
    getBufferSnapshot,
    getRecordingBuffer,
    clearRecordingBuffer,
  } = useMQTT({
    selectedKey,
    paperSpeed: chartSettings.windowMs,
    recordingStatus,
    
  });

  const selectedPatient = useMemo(
    () => devices.find((device) => device.key === selectedKey),
    [devices, selectedKey]
  );
  

  const handleRecordToggle = useCallback(
  async (deviceId: string, shouldRecord: boolean) => {

    // START RECORDING
    if (shouldRecord) {
      clearRecordingBuffer(deviceId);

      setRecordingStatus((previous) => ({
        ...previous,
        [deviceId]: true,
      }));

      return;
    }

    // STOP RECORDING
    const recording = getRecordingBuffer(deviceId);

    if (recording) {
      await saveRecording(deviceId, recording);
      console.log(recording);
      clearRecordingBuffer(deviceId);
    }

    setRecordingStatus((previous) => ({
      ...previous,
      [deviceId]: false,
    }));
  },
  [
    getRecordingBuffer,
    clearRecordingBuffer,
  ]
);

const handleManualSave = useCallback(
  async (deviceId: string) => {
    const snapshot = getBufferSnapshot(deviceId);

    if (!snapshot) {
      alert("Buffer kosong");
      return;
    }

    await saveSnapshot(deviceId, snapshot);

    alert("Snapshot berhasil disimpan.");
  },
  [getBufferSnapshot]
);
  

  const handleResetDevice = useCallback(
    (deviceId: string) => {
      publish(`devices/${deviceId}/commands`, {
        command: "reset",
        requestedAt: Date.now(),
      });
    },
    [publish]
  );

  const openAssignmentModal = useCallback((device: DeviceCard | null) => {
    setSelectedDevice(device);
    setAssignmentOpen(true);
  }, []);

  const updateChartSettings = useCallback(
    <K extends keyof ECGChartSettings>(key: K, value: ECGChartSettings[K]) => {
      setChartSettings((previous) => ({ ...previous, [key]: value }));
    },
    []
  );

  const toggleLead = useCallback((lead: ECGLeadKey) => {
    setChartSettings((previous) => ({
      ...previous,
      visibleLeads: {
        ...previous.visibleLeads,
        [lead]: !previous.visibleLeads[lead],
      },
    }));
  }, []);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!selectedKey) {
    return (
      <AppShell>
        <DeviceListView
          devices={devices}
          lastDeviceActivity={lastDeviceActivity}
          deviceError={deviceError}
          canManageAssignments={Boolean(permissions?.manageAssignments)}
          assignmentOpen={assignmentOpen}
          selectedDevice={selectedDevice}
          onOpenDevice={(deviceKey) => router.push(`/devices?key=${deviceKey}`)}
          onOpenAssignment={openAssignmentModal}
          onCloseAssignment={() => setAssignmentOpen(false)}
        />
      </AppShell>
    );
  }

  if (!selectedPatient) {
    return (
      <AppShell>
        <div className="p-6 text-white">Pasien tidak ditemukan.</div>
      </AppShell>
    );
  }

  const mqttStatus = deviceStatuses[selectedKey];
  const telemetry: DeviceTelemetry = {
    ...selectedPatient.telemetry,
    ...mqttStatus,
    mqttConnected: connectionState.connected,
    lastSeen: mqttStatus?.lastSeen ?? lastDeviceActivity[selectedKey],
  };
  

  return (
    <AppShell>
      <DeviceMonitorView
        selectedKey={selectedKey}
        patient={selectedPatient}
        leads={liveEcgData[selectedKey]}
        bpm={liveBPM[selectedKey] || 0}
        isRecording={
          recordingStatus[selectedKey] ?? selectedPatient.isRecording ?? false
        }
        telemetry={telemetry}
        lastActivityTimestamp={lastDeviceActivity[selectedKey] || null}
        connectionState={connectionState}
        invalidPayloadCount={invalidPayloadCount}
        chartSettings={chartSettings}
        permissions={permissions}
        onBack={() => router.push("/devices")}
        onRecordToggle={handleRecordToggle}
        onManualSave={handleManualSave}
        onClearBuffer={clearBuffer}
        onReconnectMQTT={reconnectMQTT}
        onResetDevice={handleResetDevice}
        onWindowChange={(value) => updateChartSettings("windowMs", value)}
        onSensitivityChange={(value: ECGSensitivity) =>
          updateChartSettings("sensitivity", value)
        }
        onAutoScaleChange={(value) => updateChartSettings("autoScale", value)}
        onFrozenChange={(value) => updateChartSettings("frozen", value)}
        onGridChange={(value) => updateChartSettings("showGrid", value)}
        onLeadToggle={toggleLead}
      />
    </AppShell>
  );
}

export default function DevicesPage() {
  return (
    <ProtectedPage permission="viewDevices">
      <Suspense
        fallback={
          <div className="min-h-screen bg-black text-white flex items-center justify-center">
            Loading...
          </div>
        }
      >
        <DevicesContent />
      </Suspense>
    </ProtectedPage>
  );
}
