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
  const [{ data: links, error: linksError }, { data: quotations, error: quotationsError }] = await Promise.all([
    supabase
      .from("purchase_requisition_rfq_links")
      .select("id, vendor_name, vendor_email, access_token, expires_at, submitted_at, created_at")
      .eq("requisition_id", requisitionId)
      .order("created_at", { ascending: true }),
    supabase
      .from("purchase_requisition_rfq_quotations")
      .select("rfq_link_id, created_at")
      .eq("requisition_id", requisitionId),
  ]);

  if (linksError) throw linksError;
  if (quotationsError) throw quotationsError;

  const receivedAtByLinkId = new Map((quotations ?? []).map((row) => [row.rfq_link_id, row.created_at]));
  const now = new Date().toISOString();

  return (links ?? []).map((row) => {
    const receivedAt = receivedAtByLinkId.get(row.id) ?? null;
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
      receivedAt,
      link: `${env.NEXT_PUBLIC_SITE_URL}${quoteFormPath(row.access_token)}`,
      status,
    };
  });
}
