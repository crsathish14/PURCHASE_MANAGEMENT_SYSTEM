"use client";

import { useState } from "react";

import { Input, Menu, MenuItem } from "@/components/atoms";
import { DATE_PRESET, type DatePreset } from "@/lib/constants/purchase-requisition";
import en from "@/locales/en.json";

const t = en.staff.poRequests.toolbar;

const PRESET_OPTIONS: Array<Exclude<DatePreset, "custom">> = [
  DATE_PRESET.LAST_1_MONTH,
  DATE_PRESET.LAST_3_MONTHS,
  DATE_PRESET.LAST_6_MONTHS,
];

export function presetLabel(preset: DatePreset): string {
  switch (preset) {
    case DATE_PRESET.LAST_1_MONTH:
      return t.dateOptions.last1Month;
    case DATE_PRESET.LAST_3_MONTHS:
      return t.dateOptions.last3Months;
    case DATE_PRESET.LAST_6_MONTHS:
      return t.dateOptions.last6Months;
    case DATE_PRESET.CUSTOM:
      return t.dateOptions.custom;
  }
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export type DateFilterValue = {
  preset: DatePreset | null;
  startDate: string | null;
  endDate: string | null;
};

export type DateRangeFilterProps = {
  label: string;
  allLabel: string;
  value: DateFilterValue;
  onChange: (next: DateFilterValue) => void;
};

// Single-select date filter. Presets close the panel immediately on pick;
// Custom keeps it open (via Menu's controlled open/onOpenChange) across both
// date fields, closing itself only once both are filled — a mix
// `closeOnContentClick`'s single flag can't express. The trigger/chip label
// always reads "Custom date" for a custom range, never the picked dates
// themselves, per an explicit product decision.
export function DateRangeFilter({ label, allLabel, value, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(value.preset === DATE_PRESET.CUSTOM);
  const [draftStart, setDraftStart] = useState(value.startDate ?? "");
  const [draftEnd, setDraftEnd] = useState(value.endDate ?? "");

  const active = value.preset !== null;
  const today = todayIsoDate();

  function selectPreset(preset: Exclude<DatePreset, "custom">) {
    setShowCustom(false);
    onChange({ preset, startDate: null, endDate: null });
    setOpen(false);
  }

  function handleCustomChange(nextStart: string, nextEnd: string) {
    setDraftStart(nextStart);
    setDraftEnd(nextEnd);
    if (nextStart && nextEnd) {
      onChange({ preset: DATE_PRESET.CUSTOM, startDate: nextStart, endDate: nextEnd });
      setOpen(false);
    }
  }

  return (
    <Menu
      align="left"
      closeOnContentClick={false}
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          className={[
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-[12.5px]",
            active ? "border-transparent bg-harbor-50 font-bold text-harbor" : "border-line bg-paper text-ink",
          ].join(" ")}
        >
          {label}: {value.preset ? presetLabel(value.preset) : allLabel}
          <ChevronIcon />
        </button>
      }
    >
      <div className="py-1">
        {PRESET_OPTIONS.map((preset) => (
          <MenuItem key={preset} onClick={() => selectPreset(preset)}>
            {presetLabel(preset)}
          </MenuItem>
        ))}
        <MenuItem onClick={() => setShowCustom(true)}>{t.dateOptions.custom}</MenuItem>

        {showCustom ? (
          <div className="space-y-2 border-t border-line px-3.5 py-2.5">
            <label className="block text-[11px] font-semibold text-slate-lt">
              {t.dateOptions.startDate}
              <Input
                type="date"
                value={draftStart}
                max={draftEnd || today}
                onChange={(event) => handleCustomChange(event.target.value, draftEnd)}
                className="mt-1 py-1.5 text-[12.5px]"
              />
            </label>
            <label className="block text-[11px] font-semibold text-slate-lt">
              {t.dateOptions.endDate}
              <Input
                type="date"
                value={draftEnd}
                min={draftStart || undefined}
                max={today}
                onChange={(event) => handleCustomChange(draftStart, event.target.value)}
                className="mt-1 py-1.5 text-[12.5px]"
              />
            </label>
          </div>
        ) : null}
      </div>
    </Menu>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 text-slate-lt" aria-hidden="true">
      <path
        d="M6 9l6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
