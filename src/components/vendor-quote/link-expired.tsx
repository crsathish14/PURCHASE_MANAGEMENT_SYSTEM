import en from "@/locales/en.json";

const t = en.vendorQuote;

export type LinkInvalidReason = "not_found" | "submitted" | "expired";

const REASON_DESCRIPTION: Record<LinkInvalidReason, string> = {
  not_found: t.notFoundDescription,
  submitted: t.alreadySubmittedDescription,
  expired: t.expiredDescription,
};

export function LinkExpired({ reason }: { reason: LinkInvalidReason }) {
  return (
    <div className="text-center">
      <h2 className="font-display text-[23px] font-semibold text-ink">{t.invalidTitle}</h2>
      <p className="mt-3 text-sm leading-relaxed text-slate">{REASON_DESCRIPTION[reason]}</p>
    </div>
  );
}
