import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { MAX_COMPARE_SELECTION } from "@/lib/constants/rfq-link";
import { getRfqQuoteComparison } from "@/lib/data/rfq-quote-comparison";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const t = en.staff.requestedQuote.linksDialog;

// Fetched by rfq-links-dialog.tsx's Compare Quote button, before opening
// CompareQuotesModal (fetch-then-open, same pattern requested-quote-view.tsx
// already uses for RfqLinksDialog itself) — the modal stays purely
// presentational, no fetching of its own.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  // Server-side clamp to MAX_COMPARE_SELECTION — the client's own checkbox
  // cap is a UX nicety, not something this route trusts on its own.
  const linkIds = (searchParams.get("linkIds") ?? "")
    .split(",")
    .filter(Boolean)
    .slice(0, MAX_COMPARE_SELECTION);

  if (linkIds.length === 0) {
    return NextResponse.json({ error: { message: t.compareLoadError } }, { status: 400 });
  }

  try {
    const data = await getRfqQuoteComparison(id, linkIds);
    if (!data) {
      return NextResponse.json({ error: { message: "Requisition not found." } }, { status: 404 });
    }
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[api/purchase-requisitions/[id]/rfq-links/compare:GET]", error);
    return NextResponse.json({ error: { message: t.compareLoadError } }, { status: 500 });
  }
}
