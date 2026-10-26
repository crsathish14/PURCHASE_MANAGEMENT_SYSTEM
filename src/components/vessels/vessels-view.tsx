"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/atoms";
import en from "@/locales/en.json";
import type { Vessel } from "@/lib/data/vessels";
import { SettingsSubnav } from "@/components/settings/subnav";

import { VesselDialog } from "./vessel-dialog";
import { VesselCards } from "./vessel-cards";

const t = en.staff.vessels;

export function VesselsView({ initialVessels }: { initialVessels: Vessel[] }) {
  const [vessels, setVessels] = useState(initialVessels);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVessel, setEditingVessel] = useState<Vessel | null>(null);

  function openAddDialog() {
    setEditingVessel(null);
    setDialogOpen(true);
  }

  function openEditDialog(vessel: Vessel) {
    setEditingVessel(vessel);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingVessel(null);
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
          {t.addVessel}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-7 md:grid-cols-[184px_1fr]">
        <SettingsSubnav active="vessels" />

        <VesselCards vessels={vessels} onEdit={openEditDialog} />
      </div>

      <VesselDialog
        open={dialogOpen}
        vessel={editingVessel}
        onClose={closeDialog}
        setVessels={setVessels}
      />
    </div>
  );
}
