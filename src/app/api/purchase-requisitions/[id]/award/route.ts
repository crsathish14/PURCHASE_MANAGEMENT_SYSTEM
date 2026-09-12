import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { awardRequisitionSchema } from "@/lib/validation/rfq-link";

const t = en.staff.requestedQuote.linksDialog;

// award_purchase_requisition's own guards: requisition not found (P0002),
// requisition no longer in quotes_received — already awarded/cancelled, or
// never reached quotes_received (55000), the given link isn't a submitted
// quote for this requisition (55001).
const NOT_FOUND_PG_CODE = "P0002";
const CONFLICT_PG_CODE = "55000";
const INVALID_LINK_PG_CODE = "55001";

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

  const parsed = awardRequisitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { message: t.awardError } }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("award_purchase_requisition", { p_id: id, p_rfq_link_id: parsed.data.rfqLinkId })
    .single();

  if (error || !data) {
    if (error?.code === NOT_FOUND_PG_CODE) {
      return NextResponse.json({ error: { message: "Requisition not found." } }, { status: 404 });
    }
    if (error?.code === CONFLICT_PG_CODE) {
      return NextResponse.json({ error: { message: t.awardConflictError } }, { status: 409 });
    }
    if (error?.code === INVALID_LINK_PG_CODE) {
      return NextResponse.json({ error: { message: t.awardInvalidLinkError } }, { status: 409 });
    }
    console.error("[api/purchase-requisitions/[id]/award:POST]", error);
    return NextResponse.json({ error: { message: t.awardError } }, { status: 500 });
  }

  return NextResponse.json({
    data: { id: data.id, status: data.status, awardedRfqLinkId: data.awarded_rfq_link_id },
  });
}
