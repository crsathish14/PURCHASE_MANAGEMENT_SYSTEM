import type { Metadata } from "next";

import en from "@/locales/en.json";
import { getRfqLinkByToken } from "@/lib/data/rfq-links";
import { LinkExpired, type LinkInvalidReason } from "@/components/vendor-quote/link-expired";
import { QuoteForm } from "@/components/vendor-quote/quote-form";

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
  const link = await getRfqLinkByToken(token);

  let invalidReason: LinkInvalidReason | null = null;
  if (!link) invalidReason = "not_found";
  else if (link.submittedAt) invalidReason = "submitted";
  else if (link.isExpired) invalidReason = "expired";

  return (
    <div className="flex min-h-screen items-center justify-center bg-mist px-6 py-10">
      <div className="w-full max-w-105 rounded-lg border border-line bg-paper p-8 shadow-(--shadow-e2)">
        {invalidReason || !link ? (
          <LinkExpired reason={invalidReason ?? "not_found"} />
        ) : (
          <QuoteForm token={token} prNumber={link.prNumber} />
        )}
      </div>
    </div>
  );
}
