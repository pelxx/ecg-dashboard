"use client";

import type { PermissionSet } from "@/lib/permissions";
import type { DeviceCard, DeviceTelemetry } from "@/types/device";
import type { ECGChartSettings, ECGLeadKey, ECGLeadSeries, ECGSensitivity } from "@/types/ecg";
import { ECG_LEADS } from "@/constants/ecg";
import PatientInfo from "@/components/patient/PatientInfo";
import DeviceStatus from "@/components/device/DeviceStatus";
import ControlPanel from "@/components/recording/ControlPanel";
import ChartSettings from "@/components/ecg/ChartSettings";
import DataLogger from "@/components/recording/DataLogger";
import ECGCanvas from "@/components/ecg/ECGCanvas";
import MedicalCard from "@/components/common/MedicalCard";
import StatusBadge from "@/components/common/StatusBadge";
import type { MQTTConnectionState } from "@/types/mqtt";

type Props = {
  readonly selectedKey: string;
  readonly patient: DeviceCard;
  readonly leads?: ECGLeadSeries;
  readonly bpm: number;
  readonly isRecording: boolean;
  readonly telemetry: DeviceTelemetry;
  readonly lastActivityTimestamp: number | null;
  readonly connectionState: MQTTConnectionState;
  readonly invalidPayloadCount: number;
  readonly chartSettings: ECGChartSettings;
  readonly permissions: PermissionSet | null;
  readonly onBack: () => void;
  readonly onRecordToggle: (deviceId: string, status: boolean) => Promise <void>;
  readonly onManualSave: (deviceId: string) => void;
  readonly onClearBuffer: (deviceId: string) => void;
  readonly onReconnectMQTT: () => void;
  readonly onResetDevice: (deviceId: string) => void;
  readonly onWindowChange: (value: number) => void;
  readonly onSensitivityChange: (value: ECGSensitivity) => void;
  readonly onAutoScaleChange: (value: boolean) => void;
  readonly onFrozenChange: (value: boolean) => void;
  readonly onGridChange: (value: boolean) => void;
  readonly onLeadToggle: (lead: ECGLeadKey) => void;
};

export default function DeviceMonitorView({
  selectedKey,
  patient,
  leads,
  bpm,
  isRecording,
  telemetry,
  lastActivityTimestamp,
  connectionState,
  invalidPayloadCount,
  chartSettings,
  permissions,
  onBack,
  onRecordToggle,
  onManualSave,
  onClearBuffer,
  onReconnectMQTT,
  onResetDevice,
  onWindowChange,
  onSensitivityChange,
  onAutoScaleChange,
  onFrozenChange,
  onGridChange,
  onLeadToggle,
}: Props) {
  return (
    <section className="space-y-5 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-emerald-300">{patient.nama}</h1>
          <p className="text-sm text-slate-500">
            MQTT {connectionState.status}
            {connectionState.error ? ` - ${connectionState.error}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={`${invalidPayloadCount} invalid payloads`}
            tone={invalidPayloadCount > 0 ? "yellow" : "gray"}
          />
          <button
            onClick={onBack}
            className="rounded bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
          >
            Kembali
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <PatientInfo
            patient={patient.assignment}
            deviceId={patient.deviceId}
            bpm={bpm}
            isRecording={isRecording}
          />

          <ChartSettings
            settings={chartSettings}
            onWindowChange={onWindowChange}
            onSensitivityChange={onSensitivityChange}
            onAutoScaleChange={onAutoScaleChange}
            onFrozenChange={onFrozenChange}
            onGridChange={onGridChange}
            onLeadToggle={onLeadToggle}
          />

          <DeviceStatus
            deviceId={selectedKey}
            mqttConnected={connectionState.connected}
            telemetry={telemetry}
            lastActivityTimestamp={lastActivityTimestamp}
          />

          <ControlPanel
            deviceId={selectedKey}
            onRecordToggle={onRecordToggle}
            onManualSave={onManualSave}
            onClearBuffer={onClearBuffer}
            onReconnectMQTT={onReconnectMQTT}
            onResetDevice={onResetDevice}
            canRecord={Boolean(permissions?.recordECG)}
            canSaveSnapshot={Boolean(permissions?.saveSnapshot)}
          />
        </div>

        <div className="space-y-4">
          <MedicalCard title="ECG Realtime" className="space-y-3">
            {ECG_LEADS.filter((lead) => chartSettings.visibleLeads[lead.key]).map(
              (lead) => (
                <ECGCanvas
                  key={lead.key}
                  title={lead.label}
                  data={leads?.[lead.key] || []}
                  windowMs={chartSettings.windowMs}
                  sensitivity={chartSettings.sensitivity}
                  autoScale={chartSettings.autoScale}
                  frozen={chartSettings.frozen}
                  showGrid={chartSettings.showGrid}
                  sampleRateHz={telemetry.sampleRateHz}
                />
              )
            )}
          </MedicalCard>

          {permissions?.viewRecordingHistory && (
            <DataLogger
              deviceId={selectedKey}
              canDownload={Boolean(permissions.downloadRecordings)}
              canDelete={Boolean(permissions.deleteRecordings)}
            />
          )}
        </div>
      </div>
    </section>
  );
}
