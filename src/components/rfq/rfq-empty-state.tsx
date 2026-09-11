"use client";

import Link from "next/link";
import { Send } from "lucide-react";

import en from "@/locales/en.json";
import { ROUTES } from "@/lib/routes";

const t = en.staff.requestedQuote.empty;

// Ref: Design-docs/design-spec.html §05 — Empty state (icon slot + one-line
// title + one-line explanation + a single action), same shape as
// purchase-requisition/empty-state.tsx. Unlike that page, there's nothing to
// "create" here — the single action links out to Purchase Requisitions
// instead, styled to match Button's secondary/sm look directly (Button
// itself always renders a native <button>, with no polymorphic/asChild
// support, so a real navigable link can't go through it).
export function RfqEmptyState() {
  return (
    <div className="rounded-xl border border-line bg-paper py-14 text-center shadow-(--shadow-e1)">
      <div className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-md bg-chip-bg text-chip">
        <Send size={18} strokeWidth={1.7} aria-hidden="true" />
      </div>
      <p className="text-[13px] font-semibold text-ink">{t.title}</p>
      <p className="mt-1 mb-2.5 text-xs text-slate-lt">{t.description}</p>
      <Link
        href={ROUTES.PO_REQUESTS}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-paper px-3 py-1.5 text-[12.5px] font-bold text-ink transition-colors hover:bg-mist focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-harbor"
      >
        {t.action}
      </Link>
    </div>
  );
}
