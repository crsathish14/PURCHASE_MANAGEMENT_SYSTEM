import type { Metadata } from "next";

import en from "@/locales/en.json";
import { PR_CATEGORY } from "@/lib/constants/purchase-requisition";
import { getRfqQuoteDetailsByToken, getRfqQuoteLineItemsPage } from "@/lib/data/rfq-quote";
import { getRfqQuoteDraftByToken } from "@/lib/data/rfq-quote-draft";
import { ExpiryCountdown } from "@/components/vendor-quote/expiry-countdown";
import { LinkExpired, type LinkInvalidReason } from "@/components/vendor-quote/link-expired";
import { QUOTE_LINE_ITEM_DEFAULT_PAGE_SIZE } from "@/lib/vendor-quote/pagination";
import { LoQuoteForm } from "@/components/vendor-quote/lo-quote-form";
import { QuoteForm } from "@/components/vendor-quote/quote-form";
import { ServiceQuoteForm } from "@/components/vendor-quote/service-quote-form";
import { SparesQuoteForm } from "@/components/vendor-quote/spares-quote-form";
import { StoresQuoteForm } from "@/components/vendor-quote/stores-quote-form";

const t = en.vendorQuote;

export const metadata: Metadata = {
  title: `${t.title} — ${en.auth.brand.word}`,
};

// The only unauthenticated page in the app — no requireActiveUser() /
// requireApiActiveUser() call anywhere on this path, and src/proxy.ts's
// gate has an explicit prefix exemption for ROUTES.QUOTE_FORM. Lives in its
// own top-level segment directly under [lang]/ (not (staff), which hard-
// requires a session; not (auth), which is about staff sign-in) — same
// shape as the change-password page's precedent for a route that needs its
// own bespoke, non-standard guard.
export default async function QuoteFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const detail = await getRfqQuoteDetailsByToken(token);

  let invalidReason: LinkInvalidReason | null = null;
  if (!detail) invalidReason = "not_found";
  else if (detail.submittedAt) invalidReason = "submitted";
  else if (detail.isExpired) invalidReason = "expired";

  // The category comes straight from the PR, never a separate manual choice.
  // Unknown categories keep the generic stub.
  const category = invalidReason ? null : (detail?.category ?? null);
  const widePage =
    category === PR_CATEGORY.STORES ||
    category === PR_CATEGORY.SPARES ||
    category === PR_CATEGORY.SERVICE ||
    category === PR_CATEGORY.LO;

  // Only the four real forms have line items to page through and a draft to
  // restore; the generic stub has neither, and an unusable link has no form.
  // Just the FIRST page of line items is loaded here — the form fetches the
  // rest a page at a time.
  const [initialPage, initialDraft] =
    invalidReason || !widePage
      ? [null, null]
      : await Promise.all([
          getRfqQuoteLineItemsPage(token, 1, QUOTE_LINE_ITEM_DEFAULT_PAGE_SIZE),
          getRfqQuoteDraftByToken(token),
        ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-mist px-6 py-10">
      <div
        className={`w-full rounded-lg border border-line bg-paper p-8 shadow-(--shadow-e2) ${
          widePage ? "max-w-6xl" : "max-w-105"
        }`}
      >
        {invalidReason || !detail || (widePage && !initialPage) ? (
          <LinkExpired reason={invalidReason ?? "not_found"} />
        ) : initialPage && category === PR_CATEGORY.STORES ? (
          <>
            <ExpiryCountdown expiresAt={detail.expiresAt} />
            <StoresQuoteForm token={token} detail={detail} initialPage={initialPage} initialDraft={initialDraft} />
          </>
        ) : initialPage && category === PR_CATEGORY.SPARES ? (
          <>
            <ExpiryCountdown expiresAt={detail.expiresAt} />
            <SparesQuoteForm token={token} detail={detail} initialPage={initialPage} initialDraft={initialDraft} />
          </>
        ) : initialPage && category === PR_CATEGORY.SERVICE ? (
          <>
            <ExpiryCountdown expiresAt={detail.expiresAt} />
            <ServiceQuoteForm token={token} detail={detail} initialPage={initialPage} initialDraft={initialDraft} />
          </>
        ) : initialPage && category === PR_CATEGORY.LO ? (
          <>
            <ExpiryCountdown expiresAt={detail.expiresAt} />
            <LoQuoteForm token={token} detail={detail} initialPage={initialPage} initialDraft={initialDraft} />
          </>
        ) : (
          <QuoteForm token={token} prNumber={detail.prNumber} />
        )}
      </div>
    </div>
  );
}
