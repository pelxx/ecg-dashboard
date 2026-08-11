"use client";

import MedicalCard from "@/components/common/MedicalCard";

export type ReportDateFilter = "all" | "today" | "last7" | "last30";
export type ReportSortOrder = "newest" | "oldest";

type Props = {
  readonly totalReports: number;
  readonly visibleReports: number;
  readonly searchTerm: string;
  readonly dateFilter: ReportDateFilter;
  readonly sortOrder: ReportSortOrder;
  readonly onSearchChange: (value: string) => void;
  readonly onDateFilterChange: (value: ReportDateFilter) => void;
  readonly onSortOrderChange: (value: ReportSortOrder) => void;
};

export default function ReportsToolbar({
  totalReports,
  visibleReports,
  searchTerm,
  dateFilter,
  sortOrder,
  onSearchChange,
  onDateFilterChange,
  onSortOrderChange,
}: Props) {
  return (
    <MedicalCard title="Reports Toolbar">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div className="grid grid-cols-2 gap-5 sm:w-auto">
          <div>
            <p className="text-sm text-slate-400">
              Total Recordings
            </p>

            <p className="text-2xl font-bold text-emerald-300">
              {totalReports}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-400">
              Matching
            </p>

            <p className="text-2xl font-bold text-emerald-300">
              {visibleReports}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto_auto]">

          <input
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search device or note"
            className="field-input"
          />

          <select
            value={dateFilter}
            onChange={(event) =>
              onDateFilterChange(event.target.value as ReportDateFilter)
            }
            className="field-input"
            aria-label="Filter reports by date"
          >
            <option value="all">
              All
            </option>
            <option value="today">
              Today
            </option>
            <option value="last7">
              Last 7 Days
            </option>
            <option value="last30">
              Last 30 Days
            </option>
          </select>

          <select
            value={sortOrder}
            onChange={(event) =>
              onSortOrderChange(event.target.value as ReportSortOrder)
            }
            className="field-input"
            aria-label="Sort reports"
          >
            <option value="newest">
              Newest
            </option>
            <option value="oldest">
              Oldest
            </option>
          </select>

        </div>

      </div>
    </MedicalCard>
  );
}
