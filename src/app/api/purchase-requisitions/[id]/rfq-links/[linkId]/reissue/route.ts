import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { env } from "@/lib/env";
import { quoteFormPath } from "@/lib/routes";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { issueRfqLinkSchema } from "@/lib/validation/rfq-link";

const t = en.staff.requestedQuote.linksDialog.reissueDialog;
// issueRfqLinkSchema is reused as-is for this form (identical shape), so its
// Zod validation messages — and this route's own 23514 fallback, for the
// same field — both come from the one shared copy path the schema already
// points at, rather than a duplicate under the new namespace.
const expiresAtPastError = en.staff.poRequests.issueRfqDialog.errors.expiresAtPast;

// Same PG error codes/meanings as the sibling POST .../rfq-links route
// (reissue_rfq_link mirrors issue_rfq_link's own guards) — P0002: the link
// itself wasn't found; 55000: the requisition is no longer eligible for new
// RFQ links (awarded/cancelled) — reissuing a link whose vendor already
// submitted a quote is no longer blocked here at all (20260912020000), the
// frontend's own warning dialog is the only gate for that case now; 23514:
// expiry in the past.
const NOT_FOUND_PG_CODE = "P0002";
const CONFLICT_PG_CODE = "55000";
const CLIENT_ERROR_PG_CODE = "23514";

export async function POST(request: Request, { params }: { params: Promise<{ linkId: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { linkId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }

  const parsed = issueRfqLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues[0]?.message ?? t.reissueError } },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("reissue_rfq_link", {
      p_link_id: linkId,
      p_vendor_name: parsed.data.vendorName,
      p_vendor_email: parsed.data.vendorEmail,
      p_expires_at: parsed.data.expiresAt,
      p_message: parsed.data.message,
    })
    .single();

  if (error || !data) {
    if (error?.code === NOT_FOUND_PG_CODE) {
      return NextResponse.json({ error: { message: "RFQ link not found." } }, { status: 404 });
    }
    if (error?.code === CONFLICT_PG_CODE) {
      return NextResponse.json({ error: { message: t.reissueConflictError } }, { status: 409 });
    }
    if (error?.code === CLIENT_ERROR_PG_CODE) {
      return NextResponse.json({ error: { message: expiresAtPastError } }, { status: 400 });
    }
    console.error("[api/purchase-requisitions/[id]/rfq-links/[linkId]/reissue:POST]", error);
    return NextResponse.json({ error: { message: t.reissueError } }, { status: 500 });
  }

  const link = `${env.NEXT_PUBLIC_SITE_URL}${quoteFormPath(data.access_token)}`;

  return NextResponse.json(
    {
      data: {
        token: data.access_token,
        link,
        vendorName: parsed.data.vendorName,
        vendorEmail: parsed.data.vendorEmail,
        message: parsed.data.message,
        expiresAt: parsed.data.expiresAt,
      },
    },
    { status: 201 },
  );
}
