import { STORAGE_BUCKET, SIGNED_DISPLAY_URL_TTL_SECONDS } from "@/lib/constants/storage";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";
import type { PrLineItemAttachment } from "./purchase-requisition";

type QuotationItemRow = Pick<
  Database["public"]["Tables"]["purchase_requisition_rfq_quotation_items"]["Row"],
  | "id"
  | "quotation_id"
  | "line_item_id"
  | "requested_description"
  | "requested_impa_code"
  | "approved_qty"
  | "uom"
  | "offered_description"
  | "offered_impa_code"
  | "unit_price"
  | "total_price"
  | "delivery_lead_time"
  | "remarks"
  | "sort_order"
>;

type AttachmentRow = Pick<
  Database["public"]["Tables"]["purchase_requisition_line_item_attachments"]["Row"],
  "line_item_id" | "storage_path" | "file_name" | "content_type" | "size_bytes" | "sort_order"
>;

type VendorPhotoRow = Pick<
  Database["public"]["Tables"]["purchase_requisition_rfq_quotation_item_photos"]["Row"],
  "quotation_item_id" | "storage_path" | "file_name" | "content_type" | "size_bytes" | "sort_order"
>;

export type QuoteComparisonLineItem = {
  lineItemId: string;
  requestedDescription: string;
  requestedImpaCode: string | null;
  approvedQty: string | null;
  uom: string | null;
  offeredDescription: string | null;
  offeredImpaCode: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  deliveryLeadTime: string | null;
  remarks: string | null;
  attachments: PrLineItemAttachment[];
  vendorPhotos: PrLineItemAttachment[];
};

export type QuoteComparisonVendor = {
  linkId: string;
  quotationId: string;
  vendorName: string;
  vendorContactPerson: string | null;
  vendorContactNo: string | null;
  vendorEmail: string | null;
  vendorOtherDetails: string | null;
  quotationNo: string | null;
  refNo: string | null;
  quotationValidity: string;
  paymentTerms: string;
  deliveryTerms: string;
  remarksNotes: string;
  totalQuotedAmount: number;
  submittedAt: string;
  lineItems: QuoteComparisonLineItem[];
};

export type QuoteComparisonData = {
  requisitionId: string;
  prNumber: string;
  requisitionNumber: string | null;
  vesselLabel: string | null;
  vesselImoNo: string | null;
  requisitionDate: string | null;
  requiredPort: string | null;
  requiredDate: string | null;
  vendors: QuoteComparisonVendor[];
};

// Staff-facing read for the Compare Quotes page. Each vendor's read-only form
// is fully self-contained (its own line-item snapshot, its own order) — no
// cross-vendor row alignment is needed here, since the page renders one
// independent card per vendor rather than a merged table. Returns null only
// if the requisition itself isn't found; if some/all of the requested
// linkIds no longer have a matching quotation (e.g. reissued away since the
// caller selected them — reissue_rfq_link hard-deletes the old link and
// cascades away its quotation), vendors[] is simply shorter than linkIds —
// the caller decides how to render that gap, not this function.
export async function getRfqQuoteComparison(
  requisitionId: string,
  linkIds: string[],
): Promise<QuoteComparisonData | null> {
  const supabase = await createClient();

  const [
    { data: listRow, error: listRowError },
    { data: prRow, error: prRowError },
  ] = await Promise.all([
    supabase
      .from("pr_requisition_list")
      .select("pr_number, requisition_number, vessel_label")
      .eq("id", requisitionId)
      .maybeSingle(),
    supabase
      .from("purchase_requisitions")
      .select("requisition_date, required_port, requested_by")
      .eq("id", requisitionId)
      .maybeSingle(),
  ]);

  if (listRowError) throw listRowError;
  if (prRowError) throw prRowError;
  if (!listRow || !prRow) return null;

  // Same vessel-option-label -> vessels.name relationship
  // get_rfq_quote_details_by_token and add_vessel() already establish —
  // done as a plain query here instead of embedded SQL since this is a
  // one-off staff read, not a security-definer RPC.
  let vesselImoNo: string | null = null;
  if (listRow.vessel_label) {
    const { data: vesselRow, error: vesselError } = await supabase
      .from("vessels")
      .select("imo_no")
      .eq("name", listRow.vessel_label)
      .maybeSingle();
    if (vesselError) throw vesselError;
    vesselImoNo = vesselRow?.imo_no ?? null;
  }

  const { data: quotationRows, error: quotationsError } = await supabase
    .from("purchase_requisition_rfq_quotations")
    .select(
      `
      id, rfq_link_id, quotation_no, ref_no, vendor_name, vendor_contact_person, vendor_contact_no,
      vendor_email, vendor_other_details, quotation_validity, payment_terms, delivery_terms,
      remarks_notes, total_quoted_amount, created_at
      `,
    )
    .eq("requisition_id", requisitionId)
    .in("rfq_link_id", linkIds);

  if (quotationsError) throw quotationsError;

  // .in() doesn't preserve input order — re-sort so the caller's selection
  // order becomes the left-to-right column order on the page.
  const quotationsByLinkId = new Map((quotationRows ?? []).map((row) => [row.rfq_link_id, row]));
  const orderedQuotations = linkIds
    .map((linkId) => quotationsByLinkId.get(linkId))
    .filter((row): row is NonNullable<typeof row> => row !== undefined);

  const quotationIds = orderedQuotations.map((row) => row.id);

  let itemRows: QuotationItemRow[] = [];
  if (quotationIds.length > 0) {
    const { data, error: itemsError } = await supabase
      .from("purchase_requisition_rfq_quotation_items")
      .select(
        `
        id, quotation_id, line_item_id, requested_description, requested_impa_code, approved_qty, uom,
        offered_description, offered_impa_code, unit_price, total_price, delivery_lead_time, remarks,
        sort_order
        `,
      )
      .in("quotation_id", quotationIds)
      .order("sort_order");
    if (itemsError) throw itemsError;
    itemRows = data ?? [];
  }

  const itemsByQuotationId = new Map<string, QuotationItemRow[]>();
  for (const row of itemRows) {
    const existing = itemsByQuotationId.get(row.quotation_id);
    if (existing) existing.push(row);
    else itemsByQuotationId.set(row.quotation_id, [row]);
  }

  const lineItemIds = [...new Set(itemRows.map((row) => row.line_item_id))];

  let attachmentRows: AttachmentRow[] = [];
  if (lineItemIds.length > 0) {
    const { data, error: attachmentsError } = await supabase
      .from("purchase_requisition_line_item_attachments")
      .select("line_item_id, storage_path, file_name, content_type, size_bytes, sort_order")
      .in("line_item_id", lineItemIds)
      .order("sort_order");
    if (attachmentsError) throw attachmentsError;
    attachmentRows = data ?? [];
  }

  const attachmentsByLineItemId = new Map<string, AttachmentRow[]>();
  for (const row of attachmentRows) {
    const existing = attachmentsByLineItemId.get(row.line_item_id);
    if (existing) existing.push(row);
    else attachmentsByLineItemId.set(row.line_item_id, [row]);
  }

  const quotationItemIds = itemRows.map((row) => row.id);
  let vendorPhotoRows: VendorPhotoRow[] = [];
  if (quotationItemIds.length > 0) {
    const { data, error: vendorPhotosError } = await supabase
      .from("purchase_requisition_rfq_quotation_item_photos")
      .select("quotation_item_id, storage_path, file_name, content_type, size_bytes, sort_order")
      .in("quotation_item_id", quotationItemIds)
      .order("sort_order");
    if (vendorPhotosError) throw vendorPhotosError;
    vendorPhotoRows = data ?? [];
  }

  const vendorPhotosByQuotationItemId = new Map<string, VendorPhotoRow[]>();
  for (const row of vendorPhotoRows) {
    const existing = vendorPhotosByQuotationItemId.get(row.quotation_item_id);
    if (existing) existing.push(row);
    else vendorPhotosByQuotationItemId.set(row.quotation_item_id, [row]);
  }

  // One batched createSignedUrls call for every photo across every vendor's
  // line items (both the office's own reference photos and the vendor's own
  // uploads share the same bucket) — session-scoped client, not admin.ts:
  // storage RLS is authenticated-only, same as getPurchaseRequisitionById's
  // own staff-side signing (admin.ts is only needed for the anonymous-vendor
  // paths in rfq-quote.ts / the photos/sign route).
  const allStoragePaths = [
    ...attachmentRows.map((row) => row.storage_path),
    ...vendorPhotoRows.map((row) => row.storage_path),
  ];
  const signedUrlByPath = new Map<string, string | null>();
  if (allStoragePaths.length > 0) {
    const { data: signedUrls, error: signError } = await supabase.storage
      .from(STORAGE_BUCKET.ATTACHMENTS)
      .createSignedUrls(allStoragePaths, SIGNED_DISPLAY_URL_TTL_SECONDS);
    if (signError) throw signError;
    for (const entry of signedUrls ?? []) {
      if (entry.path) signedUrlByPath.set(entry.path, entry.signedUrl);
    }
  }

  function mapAttachments(lineItemId: string): PrLineItemAttachment[] {
    return (attachmentsByLineItemId.get(lineItemId) ?? []).map((attachment) => ({
      storagePath: attachment.storage_path,
      fileName: attachment.file_name,
      contentType: attachment.content_type,
      sizeBytes: attachment.size_bytes,
      url: signedUrlByPath.get(attachment.storage_path) ?? null,
    }));
  }

  function mapVendorPhotos(quotationItemId: string): PrLineItemAttachment[] {
    return (vendorPhotosByQuotationItemId.get(quotationItemId) ?? []).map((photo) => ({
      storagePath: photo.storage_path,
      fileName: photo.file_name,
      contentType: photo.content_type,
      sizeBytes: photo.size_bytes,
      url: signedUrlByPath.get(photo.storage_path) ?? null,
    }));
  }

  const vendors: QuoteComparisonVendor[] = orderedQuotations.map((quotation) => ({
    linkId: quotation.rfq_link_id,
    quotationId: quotation.id,
    vendorName: quotation.vendor_name,
    vendorContactPerson: quotation.vendor_contact_person,
    vendorContactNo: quotation.vendor_contact_no,
    vendorEmail: quotation.vendor_email,
    vendorOtherDetails: quotation.vendor_other_details,
    quotationNo: quotation.quotation_no,
    refNo: quotation.ref_no,
    quotationValidity: quotation.quotation_validity,
    paymentTerms: quotation.payment_terms,
    deliveryTerms: quotation.delivery_terms,
    remarksNotes: quotation.remarks_notes,
    totalQuotedAmount: quotation.total_quoted_amount,
    submittedAt: quotation.created_at,
    lineItems: (itemsByQuotationId.get(quotation.id) ?? []).map((item) => ({
      lineItemId: item.line_item_id,
      requestedDescription: item.requested_description,
      requestedImpaCode: item.requested_impa_code,
      approvedQty: item.approved_qty === null ? null : String(item.approved_qty),
      uom: item.uom,
      offeredDescription: item.offered_description,
      offeredImpaCode: item.offered_impa_code,
      unitPrice: item.unit_price,
      totalPrice: item.total_price,
      deliveryLeadTime: item.delivery_lead_time,
      remarks: item.remarks,
      attachments: mapAttachments(item.line_item_id),
      vendorPhotos: mapVendorPhotos(item.id),
    })),
  }));

  return {
    requisitionId,
    prNumber: listRow.pr_number,
    requisitionNumber: listRow.requisition_number,
    vesselLabel: listRow.vessel_label,
    vesselImoNo,
    requisitionDate: prRow.requisition_date,
    requiredPort: prRow.required_port,
    requiredDate: prRow.requested_by,
    vendors,
  };
}
