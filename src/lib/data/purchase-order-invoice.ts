import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type InvoiceDocument = {
  id: string;
  documentType: "invoice" | "supporting";
  storagePath: string;
  originalFilename: string;
  sortOrder: number;
};

export type InvoiceVendorDetail = {
  requisitionId: string;
  prNumber: string;
  vesselLabel: string | null;
  vendorName: string;
  vendorEmail: string;
};

// Token-based lookup for the anonymous vendor page. Uses the admin client
// because the RPC is security definer (accessible to anon/authenticated) but
// Supabase's .rpc() helper still needs a client — the admin client avoids
// any session dependency for an anonymous vendor.
export async function getInvoiceByToken(token: string): Promise<InvoiceVendorDetail | null> {
  const { data, error } = await createAdminClient()
    .rpc("get_purchase_order_invoice_by_token", { p_token: token })
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    requisitionId: data.requisition_id,
    prNumber: data.pr_number,
    vesselLabel: data.vessel_label ?? null,
    vendorName: data.vendor_name,
    vendorEmail: data.vendor_email,
  };
}

// Staff lookup: retrieve documents for a submitted invoice link. Two flat
// queries joined in JS — same pattern as getRfqLinksForRequisition.
export async function getInvoiceDocumentsForRequisition(
  requisitionId: string,
): Promise<InvoiceDocument[]> {
  const supabase = await createClient();

  const { data: linkData, error: linkError } = await supabase
    .from("purchase_order_invoice_links")
    .select("id")
    .eq("requisition_id", requisitionId)
    .not("submitted_at", "is", null)
    .maybeSingle();

  if (linkError) throw linkError;
  if (!linkData) return [];

  const { data: docs, error: docsError } = await supabase
    .from("purchase_order_invoice_documents")
    .select("id, document_type, storage_path, original_filename, sort_order")
    .eq("invoice_link_id", linkData.id)
    .order("sort_order");

  if (docsError) throw docsError;

  return (docs ?? []).map((d) => ({
    id: d.id,
    documentType: d.document_type as "invoice" | "supporting",
    storagePath: d.storage_path,
    originalFilename: d.original_filename,
    sortOrder: d.sort_order,
  }));
}
