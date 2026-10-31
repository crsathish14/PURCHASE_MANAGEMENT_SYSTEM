import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { getRfqQuoteDetailsByToken } from "@/lib/data/rfq-quote";
import { getRfqQuoteSubmissionByToken } from "@/lib/data/rfq-quote-draft";
import { createClient } from "@/lib/supabase/server";
import { getVendorQuoteSchemaConfig } from "@/lib/validation/vendor-quote";

const t = en.vendorQuote;

// Deliberately NOT requireApiActiveUser() — called by an anonymous vendor
// with no session. submit_rfq_quotation validates the token itself
// (single-use + expiry, atomically — the same gate submit_rfq_link already
// used) inside its own security-definer body, alongside persisting the full
// quotation in that same transaction. No src/proxy.ts change needed either:
// /api/* paths are already fully exempted from the page-gating logic before
// it runs.
//
// The request carries no quote data. The form only ever holds one page of
// line items, so before submitting it flushes its draft (header + the visible
// page) to the server, and this route assembles the FULL quote from that
// stored draft — every line item, including rows the vendor never opened —
// then validates all of it with the same schema the form uses.
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Advisory/UX-only early check — submit_rfq_quotation's own atomic
  // `update ... where submitted_at is null` remains the sole authoritative
  // concurrency/single-submission gate either way.
  const detail = await getRfqQuoteDetailsByToken(token);
  if (!detail || detail.isExpired || detail.submittedAt) {
    return NextResponse.json({ error: { message: t.linkInvalid } }, { status: 409 });
  }

  const submission = await getRfqQuoteSubmissionByToken(token);
  if (!submission) {
    return NextResponse.json({ error: { message: t.linkInvalid } }, { status: 409 });
  }

  const { schema, blankItemFields } = getVendorQuoteSchemaConfig(detail.category);

  const parsed = schema.safeParse({
    // The link's own vendor identity is the form's pre-filled default, so it
    // stands in when the vendor never edited those fields.
    quotationNo: "",
    refNo: "",
    vendorName: detail.vendorName,
    vendorContactPerson: "",
    vendorContactNo: "",
    vendorEmail: detail.vendorEmail,
    vendorOtherDetails: "",
    quotationValidity: "",
    paymentTerms: "",
    deliveryTerms: "",
    remarksNotes: "",
    ...submission.header,
    items: submission.items.map((item) => ({
      ...blankItemFields,
      ...item.fields,
      lineItemId: item.lineItemId,
      photos: item.photos,
    })),
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    // The lowest-numbered failing row, so the form can jump to the page that
    // holds it (the failing row is usually on a page the vendor isn't viewing).
    let firstErrorItemIndex: number | null = null;
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "items" && typeof issue.path[1] === "number") {
        firstErrorItemIndex =
          firstErrorItemIndex === null ? issue.path[1] : Math.min(firstErrorItemIndex, issue.path[1]);
      }
    }
    const baseMessage = firstIssue?.message ?? t.submitError;
    const message =
      firstErrorItemIndex === null
        ? baseMessage
        : t.pagination.itemError
            .replace("{number}", String(firstErrorItemIndex + 1))
            .replace("{message}", parsed.error.issues.find((i) => i.path[1] === firstErrorItemIndex)?.message ?? baseMessage);
    return NextResponse.json({ error: { message, firstErrorItemIndex } }, { status: 400 });
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
