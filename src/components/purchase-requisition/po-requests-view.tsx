"use client";

import { useRef, useState } from "react";
import { Plus, Upload } from "lucide-react";

import { Button } from "@/components/atoms";
import en from "@/locales/en.json";
import { PR_STATUS } from "@/lib/constants/purchase-requisition";
import type { DatePreset } from "@/lib/constants/purchase-requisition";
import type { PrDetail, PrDropdownField, PrListRow } from "@/lib/data/purchase-requisition";
import { toast } from "@/store/toast-store";
import { CancelPrDialog } from "./cancel-pr-dialog";
import { CreateRequisitionDialog } from "./create-requisition-dialog";
import { EmptyState } from "./empty-state";
import { PrPager } from "./pr-pager";
import { PrTable } from "./pr-table";
import { PrToolbar } from "./pr-toolbar";

const t = en.staff.poRequests;

export type PoRequestsViewProps = {
  initialDropdownFields: PrDropdownField[];
  initialRows: PrListRow[];
  initialTotal: number;
};

const DEFAULT_PAGE_SIZE = 20;

const STATUS_OPTIONS = Object.values(PR_STATUS).map((value) => ({
  value,
  label: t.table.statusLabels[value as keyof typeof t.table.statusLabels],
}));

type ListParams = {
  page: number;
  pageSize: number;
  search: string;
  statuses: string[];
  vessels: string[];
  categories: string[];
  datePreset: DatePreset | null;
  startDate: string | null;
  endDate: string | null;
};

export function PoRequestsView({ initialDropdownFields, initialRows, initialTotal }: PoRequestsViewProps) {
  // Lifted (not owned by a single trigger) because the header CTA, the
  // empty-state CTA, and clicking any row all open this same dialog instance —
  // it's keyed by editingRequisition?.id below so switching between "create"
  // and a given row's edit/view remounts it with fresh defaultValues.
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRequisition, setEditingRequisition] = useState<PrDetail | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  const [cancelTarget, setCancelTarget] = useState<PrListRow | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);

  // What's actually been fetched — as opposed to whatever's currently staged
  // (but not yet Submitted) inside PrToolbar. Passed down so each filter chip
  // can be colored correctly, and reused by every non-toolbar refresh trigger
  // (pagination, post-mutation refetches) so a filtered view doesn't reset
  // itself just because the user paged or edited/cancelled/duplicated a row.
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedStatuses, setAppliedStatuses] = useState<string[]>([]);
  const [appliedVessels, setAppliedVessels] = useState<string[]>([]);
  const [appliedCategories, setAppliedCategories] = useState<string[]>([]);
  const [appliedDatePreset, setAppliedDatePreset] = useState<DatePreset | null>(null);
  const [appliedStartDate, setAppliedStartDate] = useState<string | null>(null);
  const [appliedEndDate, setAppliedEndDate] = useState<string | null>(null);
  const [toolbarResetKey, setToolbarResetKey] = useState(0);

  const requestIdRef = useRef(0);

  const appliedParams = {
    search: appliedSearch,
    statuses: appliedStatuses,
    vessels: appliedVessels,
    categories: appliedCategories,
    datePreset: appliedDatePreset,
    startDate: appliedStartDate,
    endDate: appliedEndDate,
  };
  const hasActiveFilters =
    appliedSearch.length > 0 ||
    appliedStatuses.length > 0 ||
    appliedVessels.length > 0 ||
    appliedCategories.length > 0 ||
    appliedDatePreset !== null;

  async function fetchList(params: ListParams) {
    // Guards against an in-flight request resolving after a newer one was
    // already issued (e.g. the search debounce firing just as the user hits
    // Submit) — a stale response is dropped instead of overwriting a newer one.
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
      if (params.search) query.set("search", params.search);
      if (params.statuses.length) query.set("status", params.statuses.join(","));
      if (params.vessels.length) query.set("vessel", params.vessels.join(","));
      if (params.categories.length) query.set("category", params.categories.join(","));
      if (params.datePreset) query.set("datePreset", params.datePreset);
      if (params.startDate) query.set("dateFrom", params.startDate);
      if (params.endDate) query.set("dateTo", params.endDate);

      const response = await fetch(`/api/purchase-requisitions?${query.toString()}`);
      const payload = await response.json();

      if (requestId !== requestIdRef.current) return;

      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.table.loadError);
        return;
      }

      // A filter/search change (or an unrelated refresh) can land on a page
      // past the new end of a shrunk result set, since the RPC's total only
      // travels alongside actual output rows — retry once at page 1 instead
      // of showing a misleading empty page.
      if (payload.data.length === 0 && params.page > 1) {
        await fetchList({ ...params, page: 1 });
        return;
      }

      setRows(payload.data);
      setTotal(payload.meta.total);
      setPage(params.page);
      setPageSize(params.pageSize);
      setAppliedSearch(params.search);
      setAppliedStatuses(params.statuses);
      setAppliedVessels(params.vessels);
      setAppliedCategories(params.categories);
      setAppliedDatePreset(params.datePreset);
      setAppliedStartDate(params.startDate);
      setAppliedEndDate(params.endDate);
    } catch {
      if (requestId === requestIdRef.current) toast.error(t.table.loadError);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  async function handleRowSelect(row: PrListRow) {
    setDetailLoadingId(row.id);
    try {
      const response = await fetch(`/api/purchase-requisitions/${row.id}`);
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.table.detailLoadError);
        return;
      }

      setEditingRequisition(payload.data);
    } catch {
      toast.error(t.table.detailLoadError);
    } finally {
      setDetailLoadingId(null);
    }
  }

  function handleDialogClose() {
    setCreateOpen(false);
    setEditingRequisition(null);
  }

  // Reads editingRequisition before handleDialogClose (called right after by
  // the dialog itself) clears it — see the comment in
  // create-requisition-dialog.tsx's onSubmit for why onSaved fires first.
  function handleDialogSaved() {
    fetchList({ page: editingRequisition ? page : 1, pageSize, ...appliedParams });
  }

  async function handleCancelConfirmed() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const response = await fetch(`/api/purchase-requisitions/${cancelTarget.id}/cancel`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.table.cancelError);
        return;
      }

      toast.success(t.table.cancelSuccess);
      setCancelTarget(null);
      fetchList({ page, pageSize, ...appliedParams });
    } catch {
      toast.error(t.table.cancelError);
    } finally {
      setCancelling(false);
    }
  }

  async function handleDuplicate(row: PrListRow) {
    setDuplicatingId(row.id);
    try {
      const response = await fetch(`/api/purchase-requisitions/${row.id}/duplicate`, { method: "POST" });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.table.duplicateError);
        return;
      }

      toast.success(t.table.duplicateSuccess);
      fetchList({ page: 1, pageSize, ...appliedParams });
    } catch {
      toast.error(t.table.duplicateError);
    } finally {
      setDuplicatingId(null);
    }
  }

  function handleSearchSettled(search: string) {
    fetchList({
      page: 1,
      pageSize,
      search,
      statuses: appliedStatuses,
      vessels: appliedVessels,
      categories: appliedCategories,
      datePreset: appliedDatePreset,
      startDate: appliedStartDate,
      endDate: appliedEndDate,
    });
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
    fetchList({ page: 1, pageSize, ...params });
  }

  function handleFilterClear() {
    // Clear appliedSearch/Statuses/Vessels/Categories/Date* synchronously, in
    // the same batch as the toolbarResetKey bump below — not just inside
    // fetchList's async resolution. PrToolbar's draft state initializes from
    // these applied* props via useState(appliedX) at mount, which only reads
    // the prop's value at the moment the remounted instance first renders;
    // if that render still saw the pre-clear values (because fetchList's
    // setAppliedX calls only happen after its awaited fetch resolves), the
    // "reset" toolbar would silently start staged with the old selections.
    setAppliedSearch("");
    setAppliedStatuses([]);
    setAppliedVessels([]);
    setAppliedCategories([]);
    setAppliedDatePreset(null);
    setAppliedStartDate(null);
    setAppliedEndDate(null);
    setToolbarResetKey((key) => key + 1);
    fetchList({
      page: 1,
      pageSize,
      search: "",
      statuses: [],
      vessels: [],
      categories: [],
      datePreset: null,
      startDate: null,
      endDate: null,
    });
  }

  const vesselOptions = initialDropdownFields.find((field) => field.key === "vessel")?.options ?? [];
  const categoryOptions = initialDropdownFields.find((field) => field.key === "category")?.options ?? [];

  return (
    <div>
      {/* Persisted header — always renders; only the content area below swaps
          between the empty state and the table + pager. */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{t.title}</h1>
          <p className="mt-1.5 text-sm text-slate">{t.subtitle}</p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="secondary" disabled>
            <Upload size={15} strokeWidth={2} aria-hidden="true" />
            {t.importExcel}
          </Button>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={15} strokeWidth={2} aria-hidden="true" />
            {t.createRequisition}
          </Button>
        </div>
      </div>

      <PrToolbar
        key={toolbarResetKey}
        statusOptions={STATUS_OPTIONS}
        vesselOptions={vesselOptions}
        categoryOptions={categoryOptions}
        appliedStatuses={appliedStatuses}
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

      {total === 0 && !hasActiveFilters ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : total === 0 && hasActiveFilters ? (
        <div className="rounded-xl border border-line bg-paper py-14 text-center shadow-(--shadow-e1)">
          <p className="text-[13px] font-semibold text-ink">{t.table.noResultsTitle}</p>
          <p className="mt-1 mb-2.5 text-xs text-slate-lt">{t.table.noResultsDescription}</p>
          <Button variant="secondary" size="sm" onClick={handleFilterClear}>
            {t.toolbar.clear}
          </Button>
        </div>
      ) : (
        <div className={loading ? "opacity-60" : undefined}>
          <PrTable
            rows={rows}
            onRowSelect={handleRowSelect}
            detailLoadingId={detailLoadingId}
            onCancelRequested={setCancelTarget}
            onDuplicate={handleDuplicate}
            duplicatingId={duplicatingId}
          />
          <PrPager
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(nextPage) => fetchList({ page: nextPage, pageSize, ...appliedParams })}
            onPageSizeChange={(nextPageSize) => fetchList({ page: 1, pageSize: nextPageSize, ...appliedParams })}
          />
        </div>
      )}

      <CreateRequisitionDialog
        key={editingRequisition?.id ?? "create"}
        open={createOpen || editingRequisition !== null}
        onClose={handleDialogClose}
        dropdownFields={initialDropdownFields}
        onSaved={handleDialogSaved}
        requisition={editingRequisition}
      />

      <CancelPrDialog
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelConfirmed}
        prNumber={cancelTarget?.prNumber ?? ""}
        loading={cancelling}
      />
    </div>
  );
}
