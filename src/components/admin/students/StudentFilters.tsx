"use client";

import { Search } from "lucide-react";

export const selectClasses =
  "rounded-xl border border-navy/15 bg-white px-3.5 py-2.5 text-sm text-navy outline-none transition-all focus:border-red focus:ring-4 focus:ring-red/10";

export default function StudentFilters({
  search,
  onSearchChange,
  phaseFilter,
  onPhaseFilterChange,
  phaseOptions,
  levelFilter,
  onLevelFilterChange,
  levelOptions,
  batchFilter,
  onBatchFilterChange,
  batchOptions,
  extra,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  phaseFilter: string;
  onPhaseFilterChange: (value: string) => void;
  phaseOptions: string[];
  levelFilter: string;
  onLevelFilterChange: (value: string) => void;
  levelOptions: string[];
  batchFilter: string;
  onBatchFilterChange: (value: string) => void;
  batchOptions: string[];
  /** Optional right-aligned slot, e.g. a link to the Inactive Students page. */
  extra?: React.ReactNode;
}) {
  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[220px] sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/35" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, email, phone, or enrollment ID"
            className="w-full rounded-xl border border-navy/15 bg-white py-2.5 pl-10 pr-4 text-sm text-navy outline-none transition-all focus:border-red focus:ring-4 focus:ring-red/10"
          />
        </div>
        <select
          value={phaseFilter}
          onChange={(e) => onPhaseFilterChange(e.target.value)}
          className={selectClasses}
          aria-label="Filter by phase"
        >
          <option value="all">All Phases</option>
          {phaseOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={levelFilter}
          onChange={(e) => onLevelFilterChange(e.target.value)}
          className={selectClasses}
          aria-label="Filter by level"
        >
          <option value="all">All Levels</option>
          {levelOptions.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={batchFilter}
          onChange={(e) => onBatchFilterChange(e.target.value)}
          className={selectClasses}
          aria-label="Filter by batch"
        >
          <option value="all">All Batches</option>
          {batchOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
      {extra}
    </div>
  );
}
