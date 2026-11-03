"use client";

import { useEffect, useRef, useState } from "react";

import { Button, Dialog, Input } from "@/components/atoms";
import { RfqPager } from "@/components/rfq/rfq-pager";
import en from "@/locales/en.json";
import type { DeliveryNoteCandidateRow } from "@/lib/data/delivery-notes";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { toast } from "@/store/toast-store";
import { DeliveryNoteUploader } from "./delivery-note-uploader";

const t = en.staff.deliveryNotes.addDialog;

export const CANDIDATE_DEFAULT_PAGE_SIZE = 10;

export type CandidatePage = { rows: DeliveryNoteCandidateRow[]; total: number };

// Fetches one page of requisitions waiting for a delivery note. Used by the
// page (to preload page 1 before the dialog opens) and by the dialog itself
// (search / paging).
export async function fetchCandidatePage(params: {
  page: number;
  pageSize: number;
  search: string;
}): Promise<CandidatePage> {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.search) query.set("search", params.search);

  const response = await fetch(`/api/delivery-notes/candidates?${query.toString()}`);
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data) throw new Error(payload?.error?.message ?? t.loadError);
  return { rows: payload.data, total: payload.meta.total };
}

// Step 1: pick a requisition that has a received proforma invoice and no
// delivery note yet (paged server-side, 10/20/50). Step 2: upload its note.
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
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DeliveryNoteCandidateRow | null>(null);
  const requestIdRef = useRef(0);

  async function load(next: { page: number; pageSize: number; search: string }) {
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
    onSearchSettledRef.current = (search) => void load({ page: 1, pageSize, search: search.trim() });
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
      <div className="mb-3 max-w-80">
        <Input
          type="text"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          className="py-2 text-[13px]"
        />
      </div>

      <div
        aria-busy={loading}
        className="overflow-hidden rounded-xl border border-line bg-paper"
      >
        <div className={loading ? "opacity-60" : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold tracking-wide text-slate-lt uppercase">
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
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-lt">
                      {appliedSearch ? t.noResults : t.empty}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelected(row)}
                      className="cursor-pointer border-b border-line last:border-b-0 hover:bg-mist/60"
                    >
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
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-line">
            <RfqPager
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={(nextPage) => void load({ page: nextPage, pageSize, search: appliedSearch })}
              onPageSizeChange={(nextPageSize) =>
                void load({ page: 1, pageSize: nextPageSize, search: appliedSearch })
              }
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
}
