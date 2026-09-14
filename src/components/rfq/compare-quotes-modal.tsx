"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Send, X } from "lucide-react";

import { Button } from "@/components/atoms";
import en from "@/locales/en.json";
import { PR_CATEGORY } from "@/lib/constants/purchase-requisition";
import type { QuoteComparisonData } from "@/lib/data/rfq-quote-comparison";
import { ServiceQuoteComparisonCard } from "./service-quote-comparison-card";
import { SparesQuoteComparisonCard } from "./spares-quote-comparison-card";
import { StoresQuoteComparisonCard } from "./stores-quote-comparison-card";

const t = en.staff.requestedQuote.compare;

// Fills the viewport (small gutter, not edge-to-edge) rather than the
// centered/max-width Dialog atom every other dialog in this app uses — the
// Stores quote form's own item table alone needs ~1100px, so up to 3 read-
// only copies side by side genuinely need the whole screen, not a capped
// modal width. Each vendor gets an equal-width column that scrolls
// independently (StoresQuoteComparisonCard is itself the scroll container),
// so all selected vendors stay visible at once with no horizontal scrolling
// of the set — only ever a vertical scroll within one column, or the item
// table's own internal horizontal scroll (unchanged from the original
// vendor-facing form).
const GRID_COLS_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

export type CompareQuotesModalProps = {
  open: boolean;
  onClose: () => void;
  data: QuoteComparisonData | null;
  requestedCount: number;
  // Opens rfq-links-dialog.tsx's own award confirm dialog on top of this
  // modal — awarding itself isn't handled here, this is purely presentational
  // (see that file for why: it owns the one shared confirm dialog + submit
  // handler used by both this modal's per-card button and the vendor
  // dialog's own per-row button).
  onAwardClick: (vendor: { linkId: string; vendorName: string }) => void;
};

export function CompareQuotesModal({ open, onClose, data, requestedCount, onAwardClick }: CompareQuotesModalProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const vendors = data?.vendors ?? [];
  const prContext = data
    ? {
        prNumber: data.prNumber,
        vesselLabel: data.vesselLabel,
        vesselImoNo: data.vesselImoNo,
        requisitionDate: data.requisitionDate,
        requiredPort: data.requiredPort,
        requiredDate: data.requiredDate,
        equipmentName: data.equipmentName,
        equipmentType: data.equipmentType,
        equipmentMake: data.equipmentMake,
        equipmentSerialNo: data.equipmentSerialNo,
        equipmentModel: data.equipmentModel,
        equipmentSpecifications: data.equipmentSpecifications,
        equipmentOtherDetails: data.equipmentOtherDetails,
      }
    : null;

  // A comparison is always scoped to one requisition, which has exactly one
  // category shared by every vendor quoted against it — so this is picked
  // once per modal render, not per vendor card.
  const ComparisonCard =
    data?.category === PR_CATEGORY.SPARES
      ? SparesQuoteComparisonCard
      : data?.category === PR_CATEGORY.SERVICE
        ? ServiceQuoteComparisonCard
        : StoresQuoteComparisonCard;

  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-ink/40 p-4 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-(--shadow-e2)"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">{t.pageTitle}</h2>
            {data ? (
              <p className="mt-0.5 text-[12.5px] text-slate">
                {t.subtitle
                  .replace("{prNumber}", data.prNumber)
                  .replace("{requisitionNumber}", data.requisitionNumber ?? "—")
                  .replace("{vesselLabel}", data.vesselLabel ?? "—")}
              </p>
            ) : null}
          </div>
          <Button type="button" variant="icon" onClick={onClose} aria-label={t.close}>
            <X size={16} strokeWidth={1.7} aria-hidden="true" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-5">
          {vendors.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-md bg-chip-bg text-chip">
                <Send size={18} strokeWidth={1.7} aria-hidden="true" />
              </div>
              <p className="text-[13px] font-semibold text-ink">{t.emptyTitle}</p>
              <p className="mt-1 text-xs text-slate-lt">{t.emptyDescription}</p>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              {vendors.length < requestedCount ? (
                <div className="mb-3 shrink-0 rounded-lg border border-[color-mix(in_srgb,var(--amber)_35%,transparent)] bg-amber-bg px-3.5 py-2.5 text-[12.5px] font-semibold text-amber">
                  {t.partialNotice
                    .replace("{shown}", String(vendors.length))
                    .replace("{requested}", String(requestedCount))}
                </div>
              ) : null}

              {prContext ? (
                <div className={`grid min-h-0 flex-1 gap-4 ${GRID_COLS_CLASS[vendors.length] ?? "grid-cols-3"}`}>
                  {vendors.map((vendor) => (
                    <ComparisonCard
                      key={vendor.linkId}
                      vendor={vendor}
                      pr={prContext}
                      isAwarded={vendor.linkId === data?.awardedLinkId}
                      canAward={!data?.awardedLinkId}
                      onAward={() => onAwardClick({ linkId: vendor.linkId, vendorName: vendor.vendorName })}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
