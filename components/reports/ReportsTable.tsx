"use client";

import MedicalCard from "@/components/common/MedicalCard";
import type { RecordingItem } from "@/services/recording.service";
import ReportRow from "./ReportRow";

type Props = {
  readonly reports: readonly RecordingItem[];
  readonly emptyMessage: string;
  readonly onView: (report: RecordingItem) => void;
  readonly onDelete: (report: RecordingItem) => void;
  readonly deletingKey: string | null;
};

export default function ReportsTable({
  reports,
  emptyMessage,
  onView,
  onDelete,
  deletingKey,
}: Props) {
  return (
    <MedicalCard title="Recording History">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-700 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Device ID</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Duration</th>
              <th className="px-4 py-3 text-right">Samples</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-10 text-center text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              reports.map((report) => (
                <ReportRow
                  key={report.key}
                  report={report}
                  onView={onView}
                  onDelete={onDelete}
                  deleting={deletingKey === report.key}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </MedicalCard>
  );
}
