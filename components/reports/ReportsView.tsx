"use client";

import { useMemo, useState } from "react";
import { useReports } from "@/hooks/useReports";
import ReportsToolbar, {
  type ReportDateFilter,
  type ReportSortOrder,
} from "./ReportsToolbar";
import ReportsTable from "./ReportsTable";
import ReportDetailModal from "./ReportDetailModal";
import MedicalCard from "@/components/common/MedicalCard";
import {
  deleteRecording,
  type RecordingItem,
} from "@/services/recording.service";

const DAY_MS = 24 * 60 * 60 * 1000;

const getDateFilterStart = (filter: ReportDateFilter): number | null => {
  const now = Date.now();

  if (filter === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.getTime();
  }

  if (filter === "last7") return now - 7 * DAY_MS;
  if (filter === "last30") return now - 30 * DAY_MS;
  return null;
};

export default function ReportsView() {
  const { records, loading, error } = useReports();

  const [selectedReport, setSelectedReport] =
    useState<RecordingItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<ReportDateFilter>("all");
  const [sortOrder, setSortOrder] = useState<ReportSortOrder>("newest");
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const visibleRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filterStart = getDateFilterStart(dateFilter);

    return records
      .filter((record) => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          record.deviceId.toLowerCase().includes(normalizedSearch) ||
          record.note.toLowerCase().includes(normalizedSearch);

        if (!matchesSearch) return false;
        if (filterStart === null) return true;

        return record.createdAt >= filterStart;
      })
      .slice()
      .sort((first, second) => {
        const direction = sortOrder === "newest" ? -1 : 1;
        return direction * (first.createdAt - second.createdAt);
      });
  }, [dateFilter, records, searchTerm, sortOrder]);

  const handleDelete = async (report: RecordingItem) => {
    if (
      !window.confirm(
        `Delete recording from ${report.deviceId}? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingKey(report.key);

    try {
      await deleteRecording(report.key);
      if (selectedReport?.key === report.key) {
        setSelectedReport(null);
      }
    } catch (nextError) {
      console.error("Failed to delete recording:", nextError);
      alert("Failed to delete recording.");
    } finally {
      setDeletingKey(null);
    }
  };

  if (loading) {
    return (
      <section className="space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-bold text-emerald-300">
            ECG Reports
          </h1>

          <p className="text-sm text-slate-500">
            Recording history and exported ECG data.
          </p>
        </div>

        <MedicalCard title="Reports">
          <div className="space-y-3 py-4">
            <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
            <div className="h-12 animate-pulse rounded bg-slate-900" />
            <div className="h-12 animate-pulse rounded bg-slate-900" />
            <div className="h-12 animate-pulse rounded bg-slate-900" />
          </div>
        </MedicalCard>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-bold text-emerald-300">
            ECG Reports
          </h1>

          <p className="text-sm text-slate-500">
            Recording history and exported ECG data.
          </p>
        </div>

        <MedicalCard title="Reports Error">
          <div className="py-12 text-center text-red-400">
            {error}
          </div>
        </MedicalCard>
      </section>
    );
  }

  return (
    <section className="space-y-5 p-6">

      <div>
        <h1 className="text-2xl font-bold text-emerald-300">
          ECG Reports
        </h1>

        <p className="text-sm text-slate-500">
          Recording history and exported ECG data.
        </p>
      </div>

      <ReportsToolbar
        totalReports={records.length}
        visibleReports={visibleRecords.length}
        searchTerm={searchTerm}
        dateFilter={dateFilter}
        sortOrder={sortOrder}
        onSearchChange={setSearchTerm}
        onDateFilterChange={setDateFilter}
        onSortOrderChange={setSortOrder}
      />

      <ReportsTable
        reports={visibleRecords}
        emptyMessage={
          records.length === 0
            ? "No recordings yet. Recorded ECG sessions will appear here automatically."
            : "No recordings match your search or filter."
        }
        onView={(report) => setSelectedReport(report)}
        onDelete={handleDelete}
        deletingKey={deletingKey}
      />

      <ReportDetailModal
        report={selectedReport}
        open={selectedReport !== null}
        onClose={() => setSelectedReport(null)}
        onDelete={handleDelete}
        deleting={deletingKey === selectedReport?.key}
      />

    </section>
  );
}
