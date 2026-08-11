"use client";

import { memo, useMemo, useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import MedicalCard from "@/components/common/MedicalCard";
import {
  convertEcgRecordToCsv,
  triggerTextDownload,
} from "@/utils/csv";
import { formatDateTime, formatDuration } from "@/utils/time";
import { useRecordings } from "@/hooks/useRecording";
import type { RecordingItem } from "@/services/recording.service";

type Props = {
  readonly deviceId: string;
  readonly canDownload: boolean;
  readonly canDelete: boolean;
};

type SortKey = "createdAt" | "durationMs" | "sampleCount";
type FilterKey = "all" | "snapshots" | "recordings";

const DataLogger = memo(function DataLogger({
  deviceId,
  canDownload,
  canDelete,
}: Props) {
  const { records, loading, error, deleteRecording, getRecordingData } =
    useRecordings(deviceId);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [filter, setFilter] = useState<FilterKey>("all");

  const visibleRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return records
      .filter((record) => {
        const note = record.note?.toLowerCase() ?? "";
        const matchesSearch =
          normalizedSearch.length === 0 ||
          note.includes(normalizedSearch) ||
          record.key.toLowerCase().includes(normalizedSearch);

        if (!matchesSearch) return false;
        if (filter === "snapshots") return note.includes("snapshot");
        if (filter === "recordings") return !note.includes("snapshot");
        return true;
      })
      .slice()
      .sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));
  }, [filter, records, search, sortKey]);

  const handleDelete = async (recordKey: string) => {
    if (!canDelete) {
      alert("Anda tidak memiliki izin untuk menghapus rekaman.");
      return;
    }

    if (!window.confirm("Yakin mau hapus data rekaman ini selamanya?")) return;

    try {
      await deleteRecording(recordKey);
    } catch (nextError) {
      console.error("Failed to delete recording:", nextError);
      alert("Gagal menghapus data.");
    }
  };

  const handleDownload = async (
    record: RecordingItem,
    format: "csv" | "json"
  ) => {
    if (!canDownload) {
      alert("Anda tidak memiliki izin untuk download rekaman.");
      return;
    }

    setDownloading(record.key);
    try {
      const rawData = await getRecordingData(record.key);
      if (!rawData) {
        alert("Tidak ada data ECG di dalam rekaman ini.");
        return;
      }

      const fileBase = `ECG_${deviceId}_${record.createdAt}`;
      if (format === "csv") {
        triggerTextDownload(
          convertEcgRecordToCsv(rawData),
          `${fileBase}.csv`,
          "text/csv;charset=utf-8;"
        );
      } else {
        triggerTextDownload(
          JSON.stringify(rawData, null, 2),
          `${fileBase}.json`,
          "application/json;charset=utf-8;"
        );
      }
    } catch (nextError) {
      console.error("Failed to download recording:", nextError);
      alert("Gagal download data.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <MedicalCard title="Data Logger">
      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search records"
          className="field-input"
        />
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as FilterKey)}
          className="field-input"
        >
          <option value="all">All</option>
          <option value="recordings">Recordings</option>
          <option value="snapshots">Snapshots</option>
        </select>
        <select
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as SortKey)}
          className="field-input"
        >
          <option value="createdAt">Created Date</option>
          <option value="durationMs">Duration</option>
          <option value="sampleCount">Sample Count</option>
        </select>
      </div>

      <div className="max-h-80 overflow-y-auto pr-2">
        {loading && <p className="py-4 text-sm text-slate-400">Memuat rekaman...</p>}
        {error && <p className="py-4 text-sm text-red-300">{error}</p>}
        {!loading && visibleRecords.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            Belum ada data rekaman untuk pasien ini.
          </p>
        )}

        {!loading && visibleRecords.length > 0 && (
          <ul className="space-y-2">
            {visibleRecords.map((record) => (
              <li
                key={record.key}
                className="rounded-md border border-slate-800 bg-slate-900/80 p-3"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">
                      {record.note || "ECG Recording"}
                    </p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 text-xs text-slate-400 md:grid-cols-4">
                      <Metric label="Created" value={formatDateTime(record.createdAt)} />
                      <Metric
                        label="Duration"
                        value={formatDuration(
                          record.durationMs ? record.durationMs / 1000 : undefined
                        )}
                      />
                      <Metric
                        label="Samples"
                        value={record.sampleCount ? String(record.sampleCount) : "--"}
                      />
                      <Metric
                        label="Rate"
                        value={record.sampleRateHz ? `${record.sampleRateHz} Hz` : "--"}
                      />
                    </dl>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <IconButton
                      label="Download CSV"
                      disabled={downloading === record.key || !canDownload}
                      onClick={() => handleDownload(record, "csv")}
                      busy={downloading === record.key}
                    />
                    <button
                      onClick={() => handleDownload(record, "json")}
                      disabled={downloading === record.key || !canDownload}
                      className="rounded bg-emerald-900 px-3 py-2 text-xs text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      JSON
                    </button>
                    <button
                      onClick={() => handleDelete(record.key)}
                      disabled={downloading === record.key || !canDelete}
                      className="rounded bg-red-600 p-2 text-white hover:bg-red-500 disabled:opacity-50"
                      aria-label="Delete"
                      title="Delete"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MedicalCard>
  );
});

function Metric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="truncate text-slate-200">{value}</dd>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  busy,
  onClick,
}: {
  readonly label: string;
  readonly disabled: boolean;
  readonly busy: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded bg-emerald-700 p-2 text-white hover:bg-emerald-600 disabled:opacity-50"
      aria-label={label}
      title={label}
    >
      {busy ? (
        <ArrowPathIcon className="h-5 w-5 animate-spin" />
      ) : (
        <ArrowDownTrayIcon className="h-5 w-5" />
      )}
    </button>
  );
}

export default DataLogger;
