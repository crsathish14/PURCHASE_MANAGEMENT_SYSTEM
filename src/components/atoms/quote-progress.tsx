export type QuoteProgressProps = {
  received: number;
  total: number;
  // Fully-composed trailing text (e.g. " of 3"), owned by the caller via its
  // own en.json copy — kept out of this atom so it stays a pure numbers-in
  // primitive with no page-specific i18n coupling.
  suffixLabel: string;
};

// Ref: Design-docs/app/rfq-list.html's `.frac` component — bold count + muted
// " of N" label above a 4px track, fill teal while partial, moss at 100%.
// total <= 0 is guarded defensively (should never happen in practice: the
// Requested Quote page's own RPC only ever returns rows with vendor_count
// >= 1) — renders a flat, empty, non-"complete" bar rather than dividing by
// zero or misreading as 100%. received > total similarly can't happen
// (rfq_quotations.rfq_link_id is unique, so a link can never produce more
// than one quotation) but the width is still clamped to 100 defensively.
export function QuoteProgress({ received, total, suffixLabel }: QuoteProgressProps) {
  const pct = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
  const complete = total > 0 && received >= total;

  return (
    <div className="flex w-16 flex-col gap-1">
      <div className="text-[12.5px]">
        <b className="font-bold text-ink">{received}</b>
        <span className="text-slate-lt">{suffixLabel}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-[3px] bg-line">
        <div
          className={`h-full rounded-[3px] ${complete ? "bg-moss" : "bg-teal"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
