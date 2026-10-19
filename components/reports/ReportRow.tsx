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
    <tr className="border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-secondary)]">
      <td className="px-4 py-3 font-medium text-[var(--foreground)]">
        {report.deviceId}
      </td>

      <td className="px-4 py-3 text-[var(--text-secondary)]">
        {format(
          new Date(report.createdAt),
          "dd MMM yyyy HH:mm:ss"
        )}
      </td>

      <td className="px-4 py-3 text-right text-[var(--foreground)]">
        {((report.durationMs ?? 0) / 1000).toFixed(1)} s
      </td>

      <td className="px-4 py-3 text-right text-[var(--foreground)]">
        {report.sampleCount ?? "-"}
      </td>

      <td className="px-4 py-3 text-center">
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() => onView(report)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--success)] text-white transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--success)]"
            aria-label="View recording"
            title="View recording"
          >
            <EyeIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(report)}
            disabled={deleting}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--danger)] text-white transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50"
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
