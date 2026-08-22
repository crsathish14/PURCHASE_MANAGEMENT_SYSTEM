"use client";

import { useState } from "react";
import { Plus, Upload } from "lucide-react";

import { Button } from "@/components/atoms";
import en from "@/locales/en.json";
import type { PrDropdownField, PrListRow } from "@/lib/data/purchase-requisition";
import { toast } from "@/store/toast-store";
import { CreateRequisitionDialog } from "./create-requisition-dialog";
import { EmptyState } from "./empty-state";
import { PrPager } from "./pr-pager";
import { PrTable } from "./pr-table";

const t = en.staff.poRequests;

export type PoRequestsViewProps = {
  initialDropdownFields: PrDropdownField[];
  initialRows: PrListRow[];
  initialTotal: number;
};

const DEFAULT_PAGE_SIZE = 20;

export function PoRequestsView({ initialDropdownFields, initialRows, initialTotal }: PoRequestsViewProps) {
  // Lifted (not owned by a single trigger) because both the header CTA and
  // the empty-state CTA below must open the same dialog instance.
  const [createOpen, setCreateOpen] = useState(false);

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

      {total === 0 ? (
        <EmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className={loading ? "opacity-60" : undefined}>
          <PrTable rows={rows} />
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
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        dropdownFields={initialDropdownFields}
        onCreated={() => fetchPage(1, pageSize)}
      />
    </div>
  );
}
