import type { Metadata } from "next";

import en from "@/locales/en.json";
import { PR_CATEGORY } from "@/lib/constants/purchase-requisition";
import { getRfqQuoteDetailsByToken } from "@/lib/data/rfq-quote";
import { LinkExpired, type LinkInvalidReason } from "@/components/vendor-quote/link-expired";
import { QuoteForm } from "@/components/vendor-quote/quote-form";
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

  // Only Stores has a real quotation form so far — every other category
  // (and any invalid-link state) keeps rendering exactly what it does today.
  // See plans/development.md: Spares/Service get their own form later,
  // reusing this same shared plumbing.
  const isStoresForm = !invalidReason && detail?.category === PR_CATEGORY.STORES;

  return (
    <div className="flex min-h-screen items-center justify-center bg-mist px-6 py-10">
      <div
        className={`w-full rounded-lg border border-line bg-paper p-8 shadow-(--shadow-e2) ${
          isStoresForm ? "max-w-6xl" : "max-w-105"
        }`}
      >
        {invalidReason || !detail ? (
          <LinkExpired reason={invalidReason ?? "not_found"} />
        ) : isStoresForm ? (
          <StoresQuoteForm token={token} detail={detail} />
        ) : (
          <QuoteForm token={token} prNumber={detail.prNumber} />
        )}
      </div>
    </div>
  );
}
