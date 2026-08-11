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
  const { isRecording, loading, updateRecordingStatus } =
    useRecordingStatus(deviceId);
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
      await updateRecordingStatus(shouldRecord);
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

  return (
    <MedicalCard title="Control Panel">
      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">
          Loading controls...
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleRecordToggle}
            disabled={processing || !canRecord}
            className={`rounded px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
              isRecording
                ? "bg-red-600 text-white hover:bg-red-500"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            {isRecording ? "Stop Recording" : "Start Recording"}
          </button>

          <button
            onClick={handleSnapshot}
            disabled={processing || isRecording || !canSaveSnapshot}
            className="rounded border border-emerald-700 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-950 disabled:opacity-50"
          >
            Snapshot
          </button>

          <button
            onClick={() => onClearBuffer(deviceId)}
            className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
          >
            Clear Buffer
          </button>

          <button
            onClick={onReconnectMQTT}
            className="rounded border border-sky-700 px-3 py-2 text-sm text-sky-100 hover:bg-sky-950"
          >
            Reconnect MQTT
          </button>

          <button
            onClick={() => onResetDevice(deviceId)}
            className="col-span-2 rounded border border-red-800 px-3 py-2 text-sm text-red-100 hover:bg-red-950"
          >
            Reset Device
          </button>
        </div>
      )}
    </MedicalCard>
  );
});

export default ControlPanel;
