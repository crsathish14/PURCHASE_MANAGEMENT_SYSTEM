"use client";

import { useState } from "react";
import { Plus, Upload } from "lucide-react";

import { Button } from "@/components/atoms";
import en from "@/locales/en.json";
import type { PrDropdownField } from "@/lib/data/purchase-requisition";
import { CreateRequisitionDialog } from "./create-requisition-dialog";
import { EmptyState } from "./empty-state";

const t = en.staff.poRequests;

export type PoRequestsViewProps = {
  initialDropdownFields: PrDropdownField[];
};

export function PoRequestsView({ initialDropdownFields }: PoRequestsViewProps) {
  // Lifted (not owned by a single trigger) because both the header CTA and
  // the empty-state CTA below must open the same dialog instance.
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div>
      {/* Persisted header — always renders; only the content area below swaps
          (currently always EmptyState; will branch to a table once a
          requisitions-list API exists). */}
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

      <EmptyState onCreate={() => setCreateOpen(true)} />

      <CreateRequisitionDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        dropdownFields={initialDropdownFields}
      />
    </div>
  );
}
