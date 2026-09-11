import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { env } from "@/lib/env";
import { getRfqLinksForRequisition } from "@/lib/data/rfq-links";
import { quoteFormPath } from "@/lib/routes";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { issueRfqLinkSchema } from "@/lib/validation/rfq-link";

const t = en.staff.poRequests.issueRfqDialog;

// issue_rfq_link's own guards: requisition not found (P0002), requisition no
// longer eligible for a new link — already quotes_received/awarded/cancelled
// (55000, this repo's shared "wrong status for this mutation" code — see
// CONFLICT_PG_CODE in src/app/api/purchase-requisitions/[id]/route.ts),
// this vendor email already has a link for this requisition (55001, a
// second distinct conflict code so this gets its own, more specific
// message than the generic one above — Reissue is the deliberate path for
// "invite this same vendor again"), expiry date in the past (23514, one of
// this repo's established client-fixable-400 codes).
const NOT_FOUND_PG_CODE = "P0002";
const CONFLICT_PG_CODE = "55000";
const DUPLICATE_VENDOR_PG_CODE = "55001";
const CLIENT_ERROR_PG_CODE = "23514";

// Every vendor ever invited to this requisition's RFQ, for the Requested
// Quote page's vendor management dialog — not paginated (a PR realistically
// has a handful of vendors, never hundreds), so a plain list is enough.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const rows = await getRfqLinksForRequisition(id);
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("[api/purchase-requisitions/[id]/rfq-links:GET]", error);
    return NextResponse.json({ error: { message: "Couldn't load RFQ links." } }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }

  const parsed = issueRfqLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues[0]?.message ?? t.issueError } },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("issue_rfq_link", {
      p_requisition_id: id,
      p_vendor_name: parsed.data.vendorName,
      p_vendor_email: parsed.data.vendorEmail,
      p_expires_at: parsed.data.expiresAt,
      p_message: parsed.data.message,
    })
    .single();

  if (error || !data) {
    if (error?.code === NOT_FOUND_PG_CODE) {
      return NextResponse.json({ error: { message: "Requisition not found." } }, { status: 404 });
    }
    if (error?.code === CONFLICT_PG_CODE) {
      return NextResponse.json({ error: { message: t.issueConflictError } }, { status: 409 });
    }
    if (error?.code === DUPLICATE_VENDOR_PG_CODE) {
      return NextResponse.json({ error: { message: t.issueDuplicateVendorError } }, { status: 409 });
    }
    if (error?.code === CLIENT_ERROR_PG_CODE) {
      return NextResponse.json({ error: { message: t.errors.expiresAtPast } }, { status: 400 });
    }
    console.error("[api/purchase-requisitions/[id]/rfq-links:POST]", error);
    return NextResponse.json({ error: { message: t.issueError } }, { status: 500 });
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
