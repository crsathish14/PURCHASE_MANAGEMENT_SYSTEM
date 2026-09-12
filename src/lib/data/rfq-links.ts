import { env } from "@/lib/env";
import { RFQ_LINK_STATUS, type RfqLinkStatus } from "@/lib/constants/rfq-link";
import { quoteFormPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export type RfqLinkLookup = {
  requisitionId: string;
  prNumber: string;
  vendorName: string;
  expiresAt: string;
  submittedAt: string | null;
  isExpired: boolean;
};

// Public lookup, called from the unauthenticated /quote/[token] page — goes
// through get_rfq_link_by_token() (security definer) rather than a plain
// .from() select, since purchase_requisition_rfq_links' own RLS is
// authenticated-only. Deliberately .maybeSingle(), not .single(): zero rows
// (unknown token) is an expected, valid outcome here, not an error.
export async function getRfqLinkByToken(token: string): Promise<RfqLinkLookup | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_rfq_link_by_token", { p_token: token }).maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    requisitionId: data.requisition_id,
    prNumber: data.pr_number,
    vendorName: data.vendor_name,
    expiresAt: data.expires_at,
    submittedAt: data.submitted_at,
    isExpired: data.is_expired,
  };
}

export type RfqLinkRow = {
  id: string;
  vendorName: string;
  vendorEmail: string;
  issuedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  receivedAt: string | null;
  link: string;
  status: RfqLinkStatus;
  // null for Pending/Expired links — there's no quotation to read these from yet.
  grandTotal: number | null;
  deliveryTerms: string | null;
  maxDeliveryLeadTimeDays: number | null;
  // True for exactly one link at most, per requisition — this vendor's quote
  // was chosen via award_purchase_requisition. Deliberately a flag on top of
  // RfqLinkStatus rather than a 4th status value: an awarded link is always
  // also, definitionally, QUOTE_RECEIVED underneath (same "keep derived
  // concepts distinct" reasoning REQUESTED_QUOTE_STATUS already documents
  // for staying separate from PR_STATUS).
  isAwarded: boolean;
};

// Staff-facing, for the RFQ vendor management dialog on the Requested Quote
// page. Two flat queries joined in JS rather than one nested
// .select("*, purchase_requisition_rfq_quotations(*)") embed — same reasoning
// getPurchaseRequisitionById already documents for its own attachments query:
// avoids relying on PostgREST's embed-shape inference (array vs. object for a
// unique-FK relationship) entirely. purchase_requisition_rfq_quotations
// already denormalizes requisition_id for exactly this kind of direct query
// (see its own migration comment), so this is its intended access pattern,
// not a workaround.
export async function getRfqLinksForRequisition(requisitionId: string): Promise<RfqLinkRow[]> {
  const supabase = await createClient();
  const [
    { data: links, error: linksError },
    { data: quotations, error: quotationsError },
    { data: requisition, error: requisitionError },
  ] = await Promise.all([
    supabase
      .from("purchase_requisition_rfq_links")
      .select("id, vendor_name, vendor_email, access_token, expires_at, submitted_at, created_at")
      .eq("requisition_id", requisitionId)
      .order("created_at", { ascending: true }),
    supabase
      .from("purchase_requisition_rfq_quotations")
      .select("id, rfq_link_id, created_at, total_quoted_amount, delivery_terms")
      .eq("requisition_id", requisitionId),
    supabase
      .from("purchase_requisitions")
      .select("awarded_rfq_link_id")
      .eq("id", requisitionId)
      .maybeSingle(),
  ]);

  if (linksError) throw linksError;
  if (quotationsError) throw quotationsError;
  if (requisitionError) throw requisitionError;

  const quotationIds = (quotations ?? []).map((row) => row.id);

  // A requisition realistically has a handful of line items, so the max is
  // computed here in JS rather than via a SQL aggregate/RPC — matches this
  // function's own existing "flat query, derive in JS" style above.
  let itemRows: Array<{ quotation_id: string; delivery_lead_time: string | null }> = [];
  if (quotationIds.length > 0) {
    const { data, error: itemsError } = await supabase
      .from("purchase_requisition_rfq_quotation_items")
      .select("quotation_id, delivery_lead_time")
      .in("quotation_id", quotationIds);
    if (itemsError) throw itemsError;
    itemRows = data ?? [];
  }

  const leadTimesByQuotationId = new Map<string, number[]>();
  for (const row of itemRows) {
    const parsed = Number(row.delivery_lead_time);
    if (!Number.isFinite(parsed)) continue;
    const existing = leadTimesByQuotationId.get(row.quotation_id);
    if (existing) existing.push(parsed);
    else leadTimesByQuotationId.set(row.quotation_id, [parsed]);
  }

  const quotationByLinkId = new Map((quotations ?? []).map((row) => [row.rfq_link_id, row]));
  const now = new Date().toISOString();

  return (links ?? []).map((row) => {
    const quotation = quotationByLinkId.get(row.id) ?? null;
    const leadTimes = quotation ? (leadTimesByQuotationId.get(quotation.id) ?? []) : [];
    const status: RfqLinkStatus = row.submitted_at
      ? RFQ_LINK_STATUS.QUOTE_RECEIVED
      : row.expires_at < now
        ? RFQ_LINK_STATUS.EXPIRED
        : RFQ_LINK_STATUS.PENDING;

    return {
      id: row.id,
      vendorName: row.vendor_name,
      vendorEmail: row.vendor_email,
      issuedAt: row.created_at,
      expiresAt: row.expires_at,
      submittedAt: row.submitted_at,
      receivedAt: quotation?.created_at ?? null,
      link: `${env.NEXT_PUBLIC_SITE_URL}${quoteFormPath(row.access_token)}`,
      status,
      grandTotal: quotation?.total_quoted_amount ?? null,
      deliveryTerms: quotation?.delivery_terms ?? null,
      maxDeliveryLeadTimeDays: leadTimes.length > 0 ? Math.max(...leadTimes) : null,
      isAwarded: row.id === requisition?.awarded_rfq_link_id,
    };
  });
}
