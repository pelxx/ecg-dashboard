"use client";

import { format } from "date-fns";
import {
  EyeIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { RecordingItem } from "@/services/recording.service";

type Props = {
  readonly report: RecordingItem;
  readonly onView: (report: RecordingItem) => void;
  readonly onDelete: (report: RecordingItem) => void;
  readonly deleting: boolean;
};

export default function ReportRow({
  report,
  onView,
  onDelete,
  deleting,
}: Props) {
  return (
    <tr className="border-b border-slate-800 hover:bg-slate-900 transition-colors">

      <td className="px-4 py-3 font-medium text-slate-100">
        {report.deviceId}
      </td>

      <td className="px-4 py-3 text-slate-300">
        {format(
          new Date(report.createdAt),
          "dd MMM yyyy HH:mm:ss"
        )}
      </td>

      <td className="px-4 py-3 text-right text-slate-300">
        {((report.durationMs ?? 0) / 1000).toFixed(1)} s
      </td>

      <td className="px-4 py-3 text-right text-slate-300">
        {report.sampleCount ?? "-"}
      </td>

      <td className="px-4 py-3 text-center">
        <div className="flex justify-center gap-2">
          <button
            onClick={() => onView(report)}
            className="inline-flex h-9 w-9 items-center justify-center rounded bg-emerald-600 text-white transition hover:bg-emerald-500"
            aria-label="View recording"
            title="View recording"
          >
            <EyeIcon className="h-4 w-4" />
          </button>

          <button
            onClick={() => onDelete(report)}
            disabled={deleting}
            className="inline-flex h-9 w-9 items-center justify-center rounded bg-red-600 text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Delete recording"
            title="Delete recording"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
