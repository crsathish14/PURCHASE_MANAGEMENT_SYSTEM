"use client";

import { Select } from "@/components/atoms";
import en from "@/locales/en.json";

const t = en.staff.poRequests.pager;

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export type PrPagerProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function PrPager({ page, pageSize, total, onPageChange, onPageSizeChange }: PrPagerProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pageNumbers = buildPageNumbers(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[12.5px] text-slate-lt">
      <span>{t.showing.replace("{from}", String(from)).replace("{to}", String(to)).replace("{total}", String(total))}</span>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          {t.rowsPerPage}
          <Select
            className="w-auto py-1"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t.previous}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            ‹
          </button>
          {pageNumbers.map((entry, index) =>
            entry === "…" ? (
              <span key={`ellipsis-${index}`} className="px-1">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-md border text-[12.5px]",
                  entry === page ? "border-harbor bg-harbor text-paper" : "border-line text-ink hover:bg-mist",
                ].join(" ")}
              >
                {entry}
              </button>
            ),
          )}
          <button
            type="button"
            aria-label={t.next}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

// Always shows page 1, the last page, and current±1 — collapses any gap to a
// single "…" (never a run of skipped numbers).
function buildPageNumbers(page: number, totalPages: number): Array<number | "…"> {
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const result: Array<number | "…"> = [];
  sorted.forEach((p, index) => {
    if (index > 0 && p - sorted[index - 1] > 1) result.push("…");
    result.push(p);
  });
  return result;
}
