"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/atoms";
import { CreateRequisitionDialog } from "@/components/purchase-requisition/create-requisition-dialog";
import en from "@/locales/en.json";
import { REQUESTED_QUOTE_STATUS } from "@/lib/constants/requested-quote";
import type { DatePreset } from "@/lib/constants/purchase-requisition";
import type { PrDetail, PrDropdownField } from "@/lib/data/purchase-requisition";
import type { RequestedQuoteListRow } from "@/lib/data/requested-quotes";
import { toast } from "@/store/toast-store";
import { RfqEmptyState } from "./rfq-empty-state";
import { RfqPager } from "./rfq-pager";
import { RfqTable } from "./rfq-table";
import { RfqToolbar } from "./rfq-toolbar";

const t = en.staff.requestedQuote;

export type RequestedQuoteViewProps = {
  initialDropdownFields: PrDropdownField[];
  initialRows: RequestedQuoteListRow[];
  initialTotal: number;
};

const DEFAULT_PAGE_SIZE = 20;

const STATUS_OPTIONS = Object.values(REQUESTED_QUOTE_STATUS).map((value) => ({
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

// Trimmed clone of purchase-requisition/po-requests-view.tsx: same state
// shape and fetch/staged-filter/pagination behavior (see that file for the
// full rationale on each piece), minus everything this page doesn't have —
// no create/import/cancel/delete/duplicate/issue-RFQ dialogs, no header CTA.
// Row click reuses the exact same fetch-by-id -> open CreateRequisitionDialog
// pattern; that dialog always opens read-only here since every reachable row
// has a status other than pending_rfq (see create-requisition-dialog.tsx's
// own mode logic).
export function RequestedQuoteView({ initialDropdownFields, initialRows, initialTotal }: RequestedQuoteViewProps) {
  const [editingRequisition, setEditingRequisition] = useState<PrDetail | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);

  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);

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

      const response = await fetch(`/api/requested-quotes?${query.toString()}`);
      const payload = await response.json();

      if (requestId !== requestIdRef.current) return;

      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.table.loadError);
        return;
      }

      // Same overrun guard as po-requests-view.tsx's fetchList — a filter/
      // search change can land on a page past the new end of a shrunk result
      // set, since the RPC's total only travels alongside actual output rows.
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

  async function handleRowSelect(row: RequestedQuoteListRow) {
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
    // Same synchronous-clear-before-remount reasoning as po-requests-view.tsx's
    // handleFilterClear — see that file's comment for why this can't just
    // rely on fetchList's async state updates.
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
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">{t.title}</h1>
        <p className="mt-1.5 text-sm text-slate">{t.subtitle}</p>
      </div>

      <RfqToolbar
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
        <RfqEmptyState />
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
          <RfqTable rows={rows} onRowSelect={handleRowSelect} detailLoadingId={detailLoadingId} />
          <RfqPager
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(nextPage) => fetchList({ page: nextPage, pageSize, ...appliedParams })}
            onPageSizeChange={(nextPageSize) => fetchList({ page: 1, pageSize: nextPageSize, ...appliedParams })}
          />
        </div>
      )}

      <CreateRequisitionDialog
        key={editingRequisition?.id ?? "closed"}
        open={editingRequisition !== null}
        onClose={() => setEditingRequisition(null)}
        dropdownFields={initialDropdownFields}
        // Every row reachable here has a status other than pending_rfq, so
        // CreateRequisitionDialog always opens in its readOnly mode and this
        // can never actually fire — wired anyway as a harmless, defensive
        // no-cost safety net, not dead code.
        onSaved={() => fetchList({ page, pageSize, ...appliedParams })}
        requisition={editingRequisition}
      />
    </div>
  );
}
