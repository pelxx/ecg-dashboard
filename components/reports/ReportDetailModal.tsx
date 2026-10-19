"use client";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ArrowDownTrayIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import MedicalCard from "@/components/common/MedicalCard";
import ECGCanvas from "@/components/ecg/ECGCanvas";
import { ECG_LEADS } from "@/constants/ecg";
import {
  getRecording,
  type RecordingItem,
  type RecordingWithData,
} from "@/services/recording.service";
import type {
  ECGDataPoint,
  ECGLeadKey,
  ECGLeadSeries,
} from "@/types/ecg";
import {
  convertEcgRecordToCsv,
  triggerTextDownload,
  type RawEcgRecordData,
} from "@/utils/csv";
import { formatDateTime, formatDuration } from "@/utils/time";

type Props = {
  readonly open: boolean;
  readonly report: RecordingItem | null;
  readonly onClose: () => void;
  readonly onDelete: (report: RecordingItem) => Promise<void>;
  readonly deleting: boolean;
};

const emptySeries: ECGLeadSeries = {
  lead1: [],
  lead2: [],
  lead3: [],
};

const parseEcgRecordData = (data: RawEcgRecordData): ECGLeadSeries => {
  const nextSeries: Record<ECGLeadKey, ECGDataPoint[]> = {
    lead1: [],
    lead2: [],
    lead3: [],
  };

  const sortedTimestamps = Object.keys(data).sort(
    (first, second) => Number(first) - Number(second)
  );

  for (const timestamp of sortedTimestamps) {
    const chunk = data[timestamp];
    const startMillis = Number(timestamp);
    const sampleIntervalMs = chunk.sampleIntervalMs ?? chunk.interval ?? 4;

    if (!Number.isFinite(startMillis)) continue;

    for (const lead of ECG_LEADS) {
      const samples = chunk[lead.key] ?? [];

      for (let index = 0; index < samples.length; index += 1) {
        nextSeries[lead.key].push({
          timestamp: startMillis + index * sampleIntervalMs,
          value: samples[index],
        });
      }
    }
  }

  return nextSeries;
};

const getCsvFileName = (report: RecordingItem): string => {
  const safeDeviceId = report.deviceId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const timestamp = format(new Date(report.createdAt), "yyyyMMdd_HHmmss");

  return `${safeDeviceId}_${timestamp}.csv`;
};

export default function ReportDetailModal({
  open,
  report,
  onClose,
  onDelete,
  deleting,
}: Props) {
  const [fullReport, setFullReport] = useState<RecordingWithData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !report) {
      setFullReport(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getRecording(report.key)
      .then((recording) => {
        if (cancelled) return;

        if (!recording) {
          setError("Recording was not found.");
          setFullReport(null);
          return;
        }

        setFullReport(recording);
      })
      .catch((nextError: unknown) => {
        if (cancelled) return;

        const message =
          nextError instanceof Error
            ? nextError.message
            : "Failed to load recording.";

        setError(message);
        setFullReport(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, report]);

  const ecgSeries = useMemo(() => {
    if (!fullReport) return emptySeries;
    return parseEcgRecordData(fullReport.data);
  }, [fullReport]);

  const hasEcgData = ECG_LEADS.some(
    (lead) => ecgSeries[lead.key].length > 0
  );

  const handleDownloadCsv = () => {
    if (!fullReport) return;

    triggerTextDownload(
      convertEcgRecordToCsv(fullReport.data),
      getCsvFileName(fullReport),
      "text/csv;charset=utf-8;"
    );
  };

  if (!open || !report) {
    return null;
  }

  const detail = fullReport ?? report;
  const isFetching = !error && (loading || fullReport?.key !== report.key);

  const secondaryButton =
    "inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <MedicalCard
          title="ECG Recording Detail"
          action={
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] transition-colors hover:opacity-80"
              aria-label="Close report detail"
              title="Close"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          }
        >
          {isFetching && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="h-16 animate-pulse rounded-md bg-[var(--surface-secondary)]" />
                <div className="h-16 animate-pulse rounded-md bg-[var(--surface-secondary)]" />
                <div className="h-16 animate-pulse rounded-md bg-[var(--surface-secondary)]" />
              </div>
              <div className="h-72 animate-pulse rounded-md bg-[var(--surface-secondary)]" />
            </div>
          )}

          {!isFetching && error && (
            <div className="py-12 text-center text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {!isFetching && !error && (
            <>
              <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                <Metric label="Device ID" value={detail.deviceId} />
                <Metric label="Note" value={detail.note || "--"} />
                <Metric
                  label="Created Time"
                  value={formatDateTime(detail.createdAt)}
                />
                <Metric
                  label="Duration"
                  value={formatDuration(
                    detail.durationMs
                      ? detail.durationMs / 1000
                      : undefined
                  )}
                />
                <Metric
                  label="Sample Rate"
                  value={
                    detail.sampleRateHz ? `${detail.sampleRateHz} Hz` : "--"
                  }
                />
                <Metric
                  label="Sample Count"
                  value={
                    detail.sampleCount ? String(detail.sampleCount) : "--"
                  }
                />
              </div>

              <div className="mt-6 space-y-4">
                {hasEcgData ? (
                  ECG_LEADS.map((lead) => (
                    <ECGCanvas
                      key={lead.key}
                      data={ecgSeries[lead.key]}
                      title={lead.label}
                      sampleRateHz={detail.sampleRateHz}
                      windowMs={5000}
                      frozen
                      showGrid
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-secondary)] p-10 text-center text-sm text-[var(--text-secondary)]">
                    No ECG samples are stored in this recording.
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  disabled={!fullReport}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--success)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Download CSV
                </button>

                <button
                  type="button"
                  onClick={() => onDelete(detail)}
                  disabled={deleting}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <TrashIcon className="h-4 w-4" />
                  {deleting ? "Deleting..." : "Delete"}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className={secondaryButton}
                >
                  Close
                </button>
              </div>
            </>
          )}
        </MedicalCard>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
      <p className="mb-1 text-xs text-[var(--text-secondary)]">{label}</p>
      <p className="break-words font-medium text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}
