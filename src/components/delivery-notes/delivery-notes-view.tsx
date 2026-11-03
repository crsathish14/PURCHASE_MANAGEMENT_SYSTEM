"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/atoms";
import { RfqPager } from "@/components/rfq/rfq-pager";
import { RfqToolbar } from "@/components/rfq/rfq-toolbar";
import en from "@/locales/en.json";
import type { DatePreset } from "@/lib/constants/purchase-requisition";
import type { DeliveryNoteListRow } from "@/lib/data/delivery-notes";
import type { PrDropdownField } from "@/lib/data/purchase-requisition";
import { toast } from "@/store/toast-store";
import {
  AddDeliveryNoteDialog,
  fetchCandidatePage,
  INITIAL_CANDIDATE_QUERY,
  type CandidatePage,
} from "./add-delivery-note-dialog";
import { DeliveryNotesDialog } from "./delivery-notes-dialog";

const t = en.staff.deliveryNotes;
const DEFAULT_PAGE_SIZE = 20;

const dateFormatter = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

type ListParams = {
  page: number;
  pageSize: number;
  search: string;
  vessels: string[];
  categories: string[];
  datePreset: DatePreset | null;
  startDate: string | null;
  endDate: string | null;
};

type InitialFilters = ListParams;

export function DeliveryNotesView({
  initialDropdownFields,
  initialRows,
  initialTotal,
  initialFilters,
}: {
  initialDropdownFields: PrDropdownField[];
  initialRows: DeliveryNoteListRow[];
  initialTotal: number;
  initialFilters: InitialFilters;
}) {
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialFilters.page);
  const [pageSize, setPageSize] = useState(initialFilters.pageSize);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  const [appliedSearch, setAppliedSearch] = useState(initialFilters.search);
  const [appliedVessels, setAppliedVessels] = useState<string[]>(initialFilters.vessels);
  const [appliedCategories, setAppliedCategories] = useState<string[]>(initialFilters.categories);
  const [appliedDatePreset, setAppliedDatePreset] = useState<DatePreset | null>(initialFilters.datePreset);
  const [appliedStartDate, setAppliedStartDate] = useState<string | null>(initialFilters.startDate);
  const [appliedEndDate, setAppliedEndDate] = useState<string | null>(initialFilters.endDate);
  const [toolbarResetKey, setToolbarResetKey] = useState(0);

  const [selectedRow, setSelectedRow] = useState<DeliveryNoteListRow | null>(null);
  const [addCandidates, setAddCandidates] = useState<CandidatePage | null>(null);
  const [openingAdd, setOpeningAdd] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  function updateUrl(params: ListParams) {
    const query = new URLSearchParams();
    if (params.page !== 1) query.set("page", String(params.page));
    if (params.pageSize !== DEFAULT_PAGE_SIZE) query.set("pageSize", String(params.pageSize));
    if (params.search) query.set("q", params.search);
    if (params.vessels.length) query.set("vessel", params.vessels.join(","));
    if (params.categories.length) query.set("category", params.categories.join(","));
    if (params.datePreset) {
      query.set("datePreset", params.datePreset);
      if (params.startDate) query.set("dateFrom", params.startDate);
      if (params.endDate) query.set("dateTo", params.endDate);
    }
    const qs = query.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  const appliedParams = {
    search: appliedSearch,
    vessels: appliedVessels,
    categories: appliedCategories,
    datePreset: appliedDatePreset,
    startDate: appliedStartDate,
    endDate: appliedEndDate,
  };

  const hasActiveFilters =
    appliedSearch.length > 0 ||
    appliedVessels.length > 0 ||
    appliedCategories.length > 0 ||
    appliedDatePreset !== null;

  async function fetchList(params: ListParams) {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(params.page),
        pageSize: String(params.pageSize),
      });
      if (params.search) query.set("search", params.search);
      if (params.vessels.length) query.set("vessel", params.vessels.join(","));
      if (params.categories.length) query.set("category", params.categories.join(","));
      if (params.datePreset) query.set("datePreset", params.datePreset);
      if (params.startDate) query.set("dateFrom", params.startDate);
      if (params.endDate) query.set("dateTo", params.endDate);

      const response = await fetch(`/api/delivery-notes?${query.toString()}`);
      const payload = await response.json();

      if (requestId !== requestIdRef.current) return;
      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.loadError);
        return;
      }

      if (payload.data.length === 0 && params.page > 1) {
        await fetchList({ ...params, page: 1 });
        return;
      }

      setRows(payload.data);
      setTotal(payload.meta.total);
      setPage(params.page);
      setPageSize(params.pageSize);
      setAppliedSearch(params.search);
      setAppliedVessels(params.vessels);
      setAppliedCategories(params.categories);
      setAppliedDatePreset(params.datePreset);
      setAppliedStartDate(params.startDate);
      setAppliedEndDate(params.endDate);
      updateUrl(params);
    } catch {
      if (requestId === requestIdRef.current) toast.error(t.loadError);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  function handleSearchSettled(search: string) {
    void fetchList({ page: 1, pageSize, ...appliedParams, search });
  }

  function handleFilterSubmit(params: {
    search: string;
    statuses: string[];
    vessels: string[];
    categories: string[];
    datePreset: DatePreset | null;
    startDate: string | null;
    endDate: string | null;
  }) {
    void fetchList({
      page: 1,
      pageSize,
      search: params.search,
      vessels: params.vessels,
      categories: params.categories,
      datePreset: params.datePreset,
      startDate: params.startDate,
      endDate: params.endDate,
    });
  }

  function handleFilterClear() {
    setAppliedSearch("");
    setAppliedVessels([]);
    setAppliedCategories([]);
    setAppliedDatePreset(null);
    setAppliedStartDate(null);
    setAppliedEndDate(null);
    setToolbarResetKey((key) => key + 1);
    void fetchList({
      page: 1,
      pageSize,
      search: "",
      vessels: [],
      categories: [],
      datePreset: null,
      startDate: null,
      endDate: null,
    });
  }

  // Preload page 1 of the picker before opening it (fetch-then-open, like the
  // RFQ vendor dialog) so the dialog never needs a fetch-on-mount effect.
  async function handleOpenAdd() {
    setOpeningAdd(true);
    try {
      setAddCandidates(
        await fetchCandidatePage(INITIAL_CANDIDATE_QUERY),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : en.staff.deliveryNotes.addDialog.loadError);
    } finally {
      setOpeningAdd(false);
    }
  }

  function handleNoteAdded() {
    setAddCandidates(null);
    // A new note moves its requisition to the top (newest upload first), so go to page 1.
    void fetchList({ ...appliedParams, page: 1, pageSize });
  }

  const vesselOptions = initialDropdownFields.find((field) => field.key === "vessel")?.options ?? [];
  const categoryOptions = initialDropdownFields.find((field) => field.key === "category")?.options ?? [];

  const ctaClass =
    "rounded-md border border-line bg-paper px-2.5 py-1.5 text-xs font-bold text-harbor transition-colors hover:bg-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-harbor";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{t.title}</h1>
          <p className="mt-1.5 text-sm text-slate">{t.subtitle}</p>
        </div>
        <Button variant="primary" onClick={() => void handleOpenAdd()} loading={openingAdd}>
          <Plus size={15} strokeWidth={2} aria-hidden="true" />
          {t.addNote}
        </Button>
      </div>

      <RfqToolbar
        key={toolbarResetKey}
        labels={t.toolbar}
        statusOptions={[]}
        vesselOptions={vesselOptions}
        categoryOptions={categoryOptions}
        appliedStatuses={[]}
        appliedVessels={appliedVessels}
        appliedCategories={appliedCategories}
        appliedDatePreset={appliedDatePreset}
        appliedStartDate={appliedStartDate}
        appliedEndDate={appliedEndDate}
        onSearchSettled={handleSearchSettled}
        onSubmit={handleFilterSubmit}
        onClear={handleFilterClear}
        submitting={loading}
      />

      <section
        aria-label={t.title}
        aria-busy={loading}
        className="overflow-hidden rounded-xl border border-line bg-paper shadow-(--shadow-e1)"
      >
        <div className={loading ? "opacity-60" : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-225 text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold tracking-wide text-slate-lt uppercase">
                  <th className="px-4 py-3">{t.columns.prRef}</th>
                  <th className="px-4 py-3">{t.columns.requisitionNumber}</th>
                  <th className="px-4 py-3">{t.columns.title}</th>
                  <th className="px-4 py-3">{t.columns.vessel}</th>
                  <th className="px-4 py-3">{t.columns.category}</th>
                  <th className="px-4 py-3">{t.columns.vendor}</th>
                  <th className="px-4 py-3">{t.columns.notes}</th>
                  <th className="px-4 py-3">{t.columns.uploaded}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-lt">
                      {hasActiveFilters ? t.noResults : t.empty}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b border-line last:border-b-0">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-ink">{row.prNumber}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-ink">
                        {row.requisitionNumber ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-ink">{row.title ?? "—"}</td>
                      <td className="px-4 py-3 text-ink">{row.vesselLabel ?? "—"}</td>
                      <td className="px-4 py-3 text-ink">{row.categoryLabel ?? "—"}</td>
                      <td className="px-4 py-3 font-semibold text-ink">{row.vendorName ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-ink">{row.noteCount}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-slate" suppressHydrationWarning>
                        {dateFormatter.format(new Date(row.lastUploadedAt))}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className={ctaClass}
                          aria-label={t.manageNotesFor.replace("{prNumber}", row.prNumber)}
                          onClick={() => setSelectedRow(row)}
                        >
                          {t.manageNotes}
                        </button>
                      </td>
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
              onPageChange={(nextPage) => void fetchList({ ...appliedParams, page: nextPage, pageSize })}
              onPageSizeChange={(nextPageSize) => void fetchList({ ...appliedParams, page: 1, pageSize: nextPageSize })}
            />
          </div>
        </div>
      </section>

      {addCandidates ? (
        <AddDeliveryNoteDialog
          open
          onClose={() => setAddCandidates(null)}
          onAdded={handleNoteAdded}
          initialRows={addCandidates.rows}
          initialTotal={addCandidates.total}
        />
      ) : null}

      {selectedRow ? (
        <DeliveryNotesDialog
          key={selectedRow.id}
          open
          onClose={() => setSelectedRow(null)}
          row={selectedRow}
          onChanged={() => void fetchList({ ...appliedParams, page, pageSize })}
        />
      ) : null}
    </div>
  );
}
