import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { PR_CATEGORY } from "@/lib/constants/purchase-requisition";
import { getRfqQuoteDetailsByToken } from "@/lib/data/rfq-quote";
import { createClient } from "@/lib/supabase/server";
import {
  submitServiceVendorQuoteSchema,
  submitSparesVendorQuoteSchema,
  submitStoresVendorQuoteSchema,
} from "@/lib/validation/vendor-quote";

const t = en.vendorQuote;

// Deliberately NOT requireApiActiveUser() — called by an anonymous vendor
// with no session. submit_rfq_quotation validates the token itself
// (single-use + expiry, atomically — the same gate submit_rfq_link already
// used) inside its own security-definer body, alongside persisting the full
// quotation in that same transaction. No src/proxy.ts change needed either:
// /api/* paths are already fully exempted from the page-gating logic before
// it runs.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Fetched first so the right category's schema can be picked (Stores,
  // Spares, and Service each have a genuinely different item shape) — this
  // also means an invalid/expired/already-submitted link now cleanly 409s
  // here regardless of payload shape, rather than sometimes surfacing a
  // generic 400 from a failed schema parse first. submit_rfq_quotation's own
  // atomic `update ... where submitted_at is null` remains the sole
  // authoritative concurrency/single-submission gate either way — this is
  // an advisory/UX-only early check, not a replacement for it.
  const detail = await getRfqQuoteDetailsByToken(token);
  if (!detail || detail.isExpired || detail.submittedAt) {
    return NextResponse.json({ error: { message: t.linkInvalid } }, { status: 409 });
  }

  const schema =
    detail.category === PR_CATEGORY.SPARES
      ? submitSparesVendorQuoteSchema
      : detail.category === PR_CATEGORY.SERVICE
        ? submitServiceVendorQuoteSchema
        : submitStoresVendorQuoteSchema;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: t.submitError } }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json({ error: { message: firstIssue?.message ?? t.submitError } }, { status: 400 });
  }

  const input = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("submit_rfq_quotation", {
      p_token: token,
      p_quotation_no: input.quotationNo,
      p_ref_no: input.refNo,
      p_vendor_name: input.vendorName,
      p_vendor_contact_person: input.vendorContactPerson,
      p_vendor_contact_no: input.vendorContactNo,
      p_vendor_email: input.vendorEmail,
      p_vendor_other_details: input.vendorOtherDetails,
      p_quotation_validity: input.quotationValidity,
      p_payment_terms: input.paymentTerms,
      p_delivery_terms: input.deliveryTerms,
      p_remarks_notes: input.remarksNotes,
      p_items: input.items,
    })
    .single();

  if (error) {
    console.error("[api/quote/[token]/submit:POST]", error);
    return NextResponse.json({ error: { message: t.submitError } }, { status: 500 });
  }

  if (!data?.success) {
    return NextResponse.json({ error: { message: t.linkInvalid } }, { status: 409 });
  }

  return NextResponse.json({ data: { success: true } });
}
