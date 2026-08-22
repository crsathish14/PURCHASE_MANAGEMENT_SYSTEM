"use client";

import { useState } from "react";
import { Plus, Upload } from "lucide-react";

import { Button } from "@/components/atoms";
import en from "@/locales/en.json";
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

  async function fetchPage(nextPage: number, nextPageSize: number) {
    setLoading(true);
    try {
      const response = await fetch(`/api/purchase-requisitions?page=${nextPage}&pageSize=${nextPageSize}`);
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.table.loadError);
        return;
      }

      setRows(payload.data);
      setTotal(payload.meta.total);
      setPage(nextPage);
      setPageSize(nextPageSize);
    } catch {
      toast.error(t.table.loadError);
    } finally {
      setLoading(false);
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
    if (editingRequisition) {
      fetchPage(page, pageSize);
    } else {
      fetchPage(1, pageSize);
    }
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
      fetchPage(page, pageSize);
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
      fetchPage(1, pageSize);
    } catch {
      toast.error(t.table.duplicateError);
    } finally {
      setDuplicatingId(null);
    }
  }

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

      <PrToolbar />

      {total === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
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
            onPageChange={(nextPage) => fetchPage(nextPage, pageSize)}
            onPageSizeChange={(nextPageSize) => fetchPage(1, nextPageSize)}
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
