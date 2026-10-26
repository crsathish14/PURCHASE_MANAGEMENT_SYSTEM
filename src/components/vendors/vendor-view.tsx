"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/atoms";
import en from "@/locales/en.json";
import type { Vendor } from "@/lib/data/vendors";
import { SettingsSubnav } from "@/components/settings/subnav";

import { VendorDialog } from "./vendor-dialog";
import { VendorTable } from "./vendor-table";

const t = en.staff.vendors;

export function VendorView({ initialVendors }: { initialVendors: Vendor[] }) {
  const [vendors, setVendors] = useState(initialVendors);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  function openAddDialog() {
    setEditingVendor(null);
    setDialogOpen(true);
  }

  function openEditDialog(vendor: Vendor) {
    setEditingVendor(vendor);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingVendor(null);
  }

  return (
    <div>
      <p className="mb-3.5 text-xs text-slate-lt">
        {t.breadcrumbSettings}
        <span className="mx-1.5">›</span>
        <b className="font-semibold text-ink">{t.breadcrumbCurrent}</b>
      </p>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{t.title}</h1>
          <p className="mt-1.5 text-sm text-slate">{t.subtitle}</p>
        </div>
        <Button variant="primary" onClick={openAddDialog}>
          <Plus size={15} strokeWidth={2} aria-hidden="true" />
          {t.addVendor}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-7 md:grid-cols-[184px_1fr]">
        <SettingsSubnav active="vendors" />

        <div className="overflow-hidden rounded-xl border border-line bg-paper shadow-(--shadow-e1)">
          <VendorTable vendors={vendors} setVendors={setVendors} onEdit={openEditDialog} />
        </div>
      </div>

      <VendorDialog
        open={dialogOpen}
        vendor={editingVendor}
        onClose={closeDialog}
        setVendors={setVendors}
      />
    </div>
  );
}
