"use client";

import { useEffect, useRef, useState } from "react";

import { ArrowUpDown } from "lucide-react";

import { Badge, Button, Dialog, Input, type BadgeTone } from "@/components/atoms";
import { FilterMultiselect, type FilterOption } from "@/components/purchase-requisition/filter-multiselect";
import { RfqPager } from "@/components/rfq/rfq-pager";
import en from "@/locales/en.json";
import {
  DELIVERY_NOTE_CANDIDATE_SORT,
  DELIVERY_NOTE_URGENCY,
  DELIVERY_NOTE_URGENCY_VALUES,
  isDeliveryNoteUrgency,
  type DeliveryNoteCandidateSort,
  type DeliveryNoteUrgency,
} from "@/lib/constants/delivery-note";
import type { DeliveryNoteCandidateRow } from "@/lib/data/delivery-notes";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { toast } from "@/store/toast-store";
import { DeliveryNoteUploader } from "./delivery-note-uploader";

const t = en.staff.deliveryNotes.addDialog;

export const CANDIDATE_DEFAULT_PAGE_SIZE = 10;

export type CandidatePage = { rows: DeliveryNoteCandidateRow[]; total: number };

export type CandidateQuery = {
  page: number;
  pageSize: number;
  search: string;
  urgencies: DeliveryNoteUrgency[];
  sort: DeliveryNoteCandidateSort;
};

// First page, no search, no status filter, natural order.
export const INITIAL_CANDIDATE_QUERY: CandidateQuery = {
  page: 1,
  pageSize: CANDIDATE_DEFAULT_PAGE_SIZE,
  search: "",
  urgencies: [],
  sort: DELIVERY_NOTE_CANDIDATE_SORT.DEFAULT,
};

// Danger = tax invoice received, warning = paid; both still lack a note.
// A coloured edge and tint on the row's first cell plus the badge text, so the
// state never relies on colour alone.
const URGENCY_STYLE: Record<DeliveryNoteUrgency, { tone: BadgeTone; row: string; edge: string }> = {
  [DELIVERY_NOTE_URGENCY.DANGER]: {
    tone: "rust",
    row: "bg-rust-bg/50 hover:bg-rust-bg",
    edge: "shadow-[inset_3px_0_0_0_var(--color-rust)]",
  },
  [DELIVERY_NOTE_URGENCY.WARNING]: {
    tone: "amber",
    row: "bg-amber-bg/50 hover:bg-amber-bg",
    edge: "shadow-[inset_3px_0_0_0_var(--color-amber)]",
  },
  [DELIVERY_NOTE_URGENCY.NORMAL]: {
    tone: "slate",
    row: "hover:bg-mist/60",
    edge: "",
  },
};

const URGENCY_OPTIONS: FilterOption[] = DELIVERY_NOTE_URGENCY_VALUES.map((value) => ({
  value,
  label: t.urgencyOptions[value],
}));

// Fetches one page of requisitions waiting for a delivery note. Used by the
// page (to preload page 1 before the dialog opens) and by the dialog itself
// (search / status filter / sort / paging) — all of which the backend applies.
export async function fetchCandidatePage(params: CandidateQuery): Promise<CandidatePage> {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.search) query.set("search", params.search);
  if (params.urgencies.length) query.set("urgency", params.urgencies.join(","));
  if (params.sort !== DELIVERY_NOTE_CANDIDATE_SORT.DEFAULT) query.set("sort", params.sort);

  const response = await fetch(`/api/delivery-notes/candidates?${query.toString()}`);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data) throw new Error(payload?.error?.message ?? t.loadError);
  return { rows: payload.data, total: payload.meta.total };
}

// Step 1: pick a requisition that has a received proforma invoice and no
// delivery note yet (searched, filtered by status, sorted and paged server-side,
// 10/20/50). Step 2: upload its note.
// Page 1 arrives preloaded as props, because the parent fetches it from the
// click handler before opening this dialog (fetch-then-open, like the RFQ
// vendor dialog) rather than from an effect.
export function AddDeliveryNoteDialog({
  open,
  onClose,
  onAdded,
  initialRows,
  initialTotal,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  initialRows: DeliveryNoteCandidateRow[];
  initialTotal: number;
}) {
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(CANDIDATE_DEFAULT_PAGE_SIZE);
  const [appliedSearch, setAppliedSearch] = useState("");
  // The status filter and sort are controls, so they update immediately; a
  // slow response for an earlier choice is dropped by the request-id guard.
  const [urgencies, setUrgencies] = useState<DeliveryNoteUrgency[]>([]);
  const [sort, setSort] = useState<DeliveryNoteCandidateSort>(DELIVERY_NOTE_CANDIDATE_SORT.DEFAULT);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DeliveryNoteCandidateRow | null>(null);
  const requestIdRef = useRef(0);

  const sortedByUrgency = sort === DELIVERY_NOTE_CANDIDATE_SORT.URGENCY;
  const hasActiveFilter = appliedSearch !== "" || urgencies.length > 0;

  function handleUrgenciesChange(next: string[]) {
    const nextUrgencies = next.filter(isDeliveryNoteUrgency);
    setUrgencies(nextUrgencies);
    void load({ page: 1, pageSize, search: appliedSearch, urgencies: nextUrgencies, sort });
  }

  function handleSortToggle() {
    const nextSort = sortedByUrgency ? DELIVERY_NOTE_CANDIDATE_SORT.DEFAULT : DELIVERY_NOTE_CANDIDATE_SORT.URGENCY;
    setSort(nextSort);
    void load({ page: 1, pageSize, search: appliedSearch, urgencies, sort: nextSort });
  }

  async function load(next: CandidateQuery) {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const result = await fetchCandidatePage(next);
      if (requestId !== requestIdRef.current) return;

      // A page past the end (the last row on it was just taken) falls back to page 1.
      if (result.rows.length === 0 && next.page > 1) {
        await load({ ...next, page: 1 });
        return;
      }

      setRows(result.rows);
      setTotal(result.total);
      setPage(next.page);
      setPageSize(next.pageSize);
      setAppliedSearch(next.search);
    } catch (error) {
      if (requestId === requestIdRef.current) {
        toast.error(error instanceof Error ? error.message : t.loadError);
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 500);
  const lastFiredSearchRef = useRef(searchInput);
  // The effect below must refire only when the typed text settles, not when the
  // page size changes, so it calls through a ref that always holds the latest load.
  const onSearchSettledRef = useRef<(search: string) => void>(() => {});
  useEffect(() => {
    onSearchSettledRef.current = (search) =>
      void load({ page: 1, pageSize, search: search.trim(), urgencies, sort });
  });
  useEffect(() => {
    if (debouncedSearch === lastFiredSearchRef.current) return;
    lastFiredSearchRef.current = debouncedSearch;
    onSearchSettledRef.current(debouncedSearch);
  }, [debouncedSearch]);

  if (selected) {
    return (
      <Dialog open={open} onClose={onClose} title={t.uploadTitle} size="md">
        <p className="text-sm text-slate">{t.uploadSubtitle.replace("{prNumber}", selected.prNumber)}</p>
        <div className="mt-4">
          <DeliveryNoteUploader
            requisitionId={selected.id}
            onUploaded={onAdded}
            onCancel={() => setSelected(null)}
            cancelLabel={t.back}
          />
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t.title}
      size="xl"
      footer={
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t.close}
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-slate">{t.subtitle}</p>
      <div className="mb-2 flex flex-wrap items-center gap-2.5">
        <div className="min-w-60 max-w-80 flex-1">
          <Input
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchPlaceholder}
            className="py-2 text-[13px]"
          />
        </div>
        <FilterMultiselect
          label={t.statusFilter.label}
          options={URGENCY_OPTIONS}
          selected={urgencies}
          onChange={handleUrgenciesChange}
          allLabel={t.statusFilter.all}
          nSelectedLabel={(count) => t.statusFilter.nSelected.replace("{count}", String(count))}
          zIndexClassName="z-40"
        />
        <button
          type="button"
          aria-pressed={sortedByUrgency}
          title={t.sortByUrgencyHint}
          onClick={handleSortToggle}
          className={[
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-[12.5px]",
            sortedByUrgency ? "border-transparent bg-harbor-50 font-bold text-harbor" : "border-line bg-paper text-ink",
          ].join(" ")}
        >
          <ArrowUpDown size={13} strokeWidth={2} aria-hidden="true" />
          {t.sortByUrgency}
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-lt">{t.legend}</p>

      <div
        aria-busy={loading}
        className="overflow-hidden rounded-xl border border-line bg-paper"
      >
        <div className={loading ? "opacity-60" : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold tracking-wide text-slate-lt uppercase">
                  <th className="px-4 py-3">{t.columns.status}</th>
                  <th className="px-4 py-3">{t.columns.prRef}</th>
                  <th className="px-4 py-3">{t.columns.requisitionNumber}</th>
                  <th className="px-4 py-3">{t.columns.title}</th>
                  <th className="px-4 py-3">{t.columns.vessel}</th>
                  <th className="px-4 py-3">{t.columns.category}</th>
                  <th className="px-4 py-3">{t.columns.vendor}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-lt">
                      {hasActiveFilter ? t.noResults : t.empty}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const style = URGENCY_STYLE[row.urgency];
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelected(row)}
                        className={`cursor-pointer border-b border-line last:border-b-0 ${style.row}`}
                      >
                        <td className={`whitespace-nowrap px-4 py-3 ${style.edge}`}>
                          <Badge tone={style.tone}>{t.urgency[row.urgency]}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-ink">
                          <button
                            type="button"
                            aria-label={t.selectFor.replace("{prNumber}", row.prNumber)}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelected(row);
                            }}
                            className="font-mono font-semibold text-harbor hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-harbor"
                          >
                            {row.prNumber}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-ink">
                          {row.requisitionNumber ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-ink">{row.title ?? "—"}</td>
                        <td className="px-4 py-3 text-ink">{row.vesselLabel ?? "—"}</td>
                        <td className="px-4 py-3 text-ink">{row.categoryLabel ?? "—"}</td>
                        <td className="px-4 py-3 text-ink">{row.vendorName ?? "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-line">
            <RfqPager
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={(nextPage) =>
                void load({ page: nextPage, pageSize, search: appliedSearch, urgencies, sort })
              }
              onPageSizeChange={(nextPageSize) =>
                void load({ page: 1, pageSize: nextPageSize, search: appliedSearch, urgencies, sort })
              }
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
