"use client";

import { memo, useState } from "react";
import MedicalCard from "@/components/common/MedicalCard";
import { useRecordingStatus } from "@/hooks/useRecording";

type Props = {
  readonly deviceId: string;
  readonly onRecordToggle: (
    deviceId: string,
    shouldRecord: boolean
  ) => Promise<void>;
  readonly onManualSave: (deviceId: string) => void;
  readonly onClearBuffer: (deviceId: string) => void;
  readonly onReconnectMQTT: () => void;
  readonly onResetDevice: (deviceId: string) => void;
  readonly canRecord: boolean;
  readonly canSaveSnapshot: boolean;
};

const ControlPanel = memo(function ControlPanel({
  deviceId,
  onRecordToggle,
  onManualSave,
  onClearBuffer,
  onReconnectMQTT,
  onResetDevice,
  canRecord,
  canSaveSnapshot,
}: Props) {
  const { isRecording, loading } = useRecordingStatus(deviceId);
  const [processing, setProcessing] = useState(false);

  const handleRecordToggle = async () => {
    if (!canRecord) {
      alert("Anda tidak memiliki izin untuk merekam ECG.");
      return;
    }

    const shouldRecord = !isRecording;
    setProcessing(true);

    try {
      await onRecordToggle(deviceId, shouldRecord);
    } catch (error) {
      console.error("Failed to update recording status:", error);
      alert("Gagal mengubah status recording.");
    } finally {
      setProcessing(false);
    }
  };

  const handleSnapshot = () => {
    if (!canSaveSnapshot) {
      alert("Anda tidak memiliki izin untuk menyimpan snapshot.");
      return;
    }

    onManualSave(deviceId);
  };

  const secondaryButton =
    "rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <MedicalCard title="Control Panel">
      {loading ? (
        <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
          Loading controls...
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleRecordToggle}
            disabled={processing || !canRecord}
            className={`rounded-md px-3 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isRecording
                ? "bg-[var(--danger)] hover:opacity-85"
                : "bg-[var(--success)] hover:opacity-85"
            }`}
          >
            {isRecording ? "Stop Recording" : "Start Recording"}
          </button>

          <button
            type="button"
            onClick={handleSnapshot}
            disabled={processing || isRecording || !canSaveSnapshot}
            className={`${secondaryButton} border-[var(--primary)] text-[var(--primary)]`}
          >
            Snapshot
          </button>

          <button
            type="button"
            onClick={() => onClearBuffer(deviceId)}
            className={secondaryButton}
          >
            Clear Buffer
          </button>

          <button
            type="button"
            onClick={onReconnectMQTT}
            className={`${secondaryButton} border-sky-500/40 text-sky-700 dark:text-sky-300`}
          >
            Reconnect MQTT
          </button>

          <button
            type="button"
            onClick={() => onResetDevice(deviceId)}
            className="col-span-2 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)] transition-colors hover:opacity-80"
          >
            Reset Device
          </button>
        </div>
      )}
    </MedicalCard>
  );
});

export default ControlPanel;
