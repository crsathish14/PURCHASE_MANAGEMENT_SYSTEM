"use client";

import { ClipboardList } from "lucide-react";

import { Button } from "@/components/atoms";
import en from "@/locales/en.json";

const t = en.staff.poRequests.empty;

export type EmptyStateProps = {
  onCreate: () => void;
};

// Ref: Design-docs/design-spec.html §05 — Empty state (icon slot + one-line
// title + one-line explanation + a single action). variant="primary" here
// (not the design demo's secondary "Clear filters") since this is a true
// zero-state whose one action is the primary next step, not a filter-recovery action.
export function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-line bg-paper py-14 text-center shadow-(--shadow-e1)">
      <div className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-md bg-chip-bg text-chip">
        <ClipboardList size={18} strokeWidth={1.7} aria-hidden="true" />
      </div>
      <p className="text-[13px] font-semibold text-ink">{t.title}</p>
      <p className="mt-1 mb-2.5 text-xs text-slate-lt">{t.description}</p>
      <Button variant="primary" size="sm" onClick={onCreate}>
        {t.action}
      </Button>
    </div>
  );
}
