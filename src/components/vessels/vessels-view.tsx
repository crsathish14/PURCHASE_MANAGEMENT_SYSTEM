"use client";

import { useState } from "react";

import en from "@/locales/en.json";
import type { Vessel } from "@/lib/data/vessels";
import { SettingsSubnav } from "@/components/settings/subnav";

import { VesselDialog } from "./vessel-dialog";
import { VesselTable } from "./vessel-table";

const t = en.staff.vessels;

export function VesselsView({ initialVessels }: { initialVessels: Vessel[] }) {
  const [vessels, setVessels] = useState(initialVessels);

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
        <VesselDialog setVessels={setVessels} />
      </div>

      <div className="grid grid-cols-1 gap-7 md:grid-cols-[184px_1fr]">
        <SettingsSubnav active="vessels" />

        <div className="overflow-hidden rounded-xl border border-line bg-paper shadow-(--shadow-e1)">
          <VesselTable vessels={vessels} />
        </div>
      </div>
    </div>
  );
}
