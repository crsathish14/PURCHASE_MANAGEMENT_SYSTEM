import type { PurchaseOrderStatus } from "@/lib/constants/purchase-order";
import type { DatePreset } from "@/lib/constants/purchase-requisition";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

export type PurchaseOrderListRow = {
  id: string;
  prNumber: string;
  requisitionNumber: string | null;
  title: string | null;
  vesselLabel: string | null;
  vendorName: string;
  vendorId: string | null;
  quoteReference: string | null;
  totalQuotedAmount: number;
  quoteSubmittedAt: string;
  status: PurchaseOrderStatus;
};

export type PurchaseOrderFilters = {
  search?: string;
  statuses?: PurchaseOrderStatus[];
  vessels?: string[];
  categories?: string[];
  datePreset?: DatePreset;
  startDate?: string;
  endDate?: string;
};

export type PurchaseOrderDraftItemInput = {
  quotationItemId: string;
  neededPoQty: number;
};

export async function savePurchaseOrderDraft({
  requisitionId,
  items,
  sameAsQuoteQty,
}: {
  requisitionId: string;
  items: PurchaseOrderDraftItemInput[];
  sameAsQuoteQty: boolean;
}): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_purchase_order_draft", {
    p_requisition_id: requisitionId,
    p_items: items.map((item) => ({
      quotation_item_id: item.quotationItemId,
      needed_po_qty: item.neededPoQty,
    })),
    p_same_as_quote_qty: sameAsQuoteQty,
  });

  if (error) throw error;
  return data;
}

export async function issuePurchaseOrder({
  requisitionId,
  items,
  sameAsQuoteQty,
  message,
  invoiceCompanyName,
  invoiceAddress,
}: {
  requisitionId: string;
  items: PurchaseOrderDraftItemInput[];
  sameAsQuoteQty: boolean;
  message: string;
  invoiceCompanyName: string;
  invoiceAddress: string;
}): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_purchase_order", {
    p_requisition_id: requisitionId,
    p_items: items.map((item) => ({
      quotation_item_id: item.quotationItemId,
      needed_po_qty: item.neededPoQty,
    })),
    p_same_as_quote_qty: sameAsQuoteQty,
    p_message: message,
    p_invoice_to_company_name: invoiceCompanyName,
    p_invoice_to_address: invoiceAddress,
  });

  if (error) throw error;
  return data;
}

export async function getPurchaseOrderIssueToken(requisitionId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_purchase_order_issue_token", {
    p_requisition_id: requisitionId,
  });

  if (error) throw error;
  return data;
}

export type PurchaseOrderVendorItem = {
  description: string;
  partNo: string | null;
  uom: string | null;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number;
};

export type PurchaseOrderVendorDetail = {
  requisitionId: string;
  prNumber: string;
  vesselLabel: string | null;
  category: string | null;
  vendorName: string;
  vendorEmail: string;
  message: string;
  issuedAt: string;
  items: PurchaseOrderVendorItem[];
};

export type PurchaseOrderPdfTokenItem = {
  description: string;
  impaCode: string | null;
  partNo: string | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number;
  leadTime: string | null;
  remarks: string | null;
};

export type PurchaseOrderPdfTokenDetail = {
  requisitionId: string;
  prNumber: string;
  requisitionTitle: string | null;
  category: string;
  vesselName: string | null;
  vesselImoNo: string | null;
  vesselMasterOwners: string | null;
  issuedVendorName: string;
  issuedVendorEmail: string;
  vendorContactPerson: string | null;
  quotationNo: string | null;
  refNo: string | null;
  paymentTerms: string;
  invoiceCompanyName: string;
  invoiceAddress: string;
  issuedAt: string;
  items: PurchaseOrderPdfTokenItem[];
};

export async function getPurchaseOrderByToken(token: string): Promise<PurchaseOrderVendorDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_purchase_order_by_token", { p_token: token }).maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const rawItems = Array.isArray(data.items) ? (data.items as Json[]) : [];
  return {
    requisitionId: data.requisition_id,
    prNumber: data.pr_number,
    vesselLabel: data.vessel_label,
    category: data.category,
    vendorName: data.vendor_name,
    vendorEmail: data.vendor_email,
    message: data.message,
    issuedAt: data.issued_at,
    items: rawItems.map((item) => item as PurchaseOrderVendorItem),
  };
}

export async function getPurchaseOrderPdfByToken(token: string): Promise<PurchaseOrderPdfTokenDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_purchase_order_pdf_by_token", { p_token: token })
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const rawItems = Array.isArray(data.items) ? (data.items as Json[]) : [];
  return {
    requisitionId: data.requisition_id,
    prNumber: data.pr_number,
    requisitionTitle: data.requisition_title,
    category: data.category,
    vesselName: data.vessel_name,
    vesselImoNo: data.vessel_imo_no,
    vesselMasterOwners: data.vessel_master_owners,
    issuedVendorName: data.issued_vendor_name,
    issuedVendorEmail: data.issued_vendor_email,
    vendorContactPerson: data.vendor_contact_person,
    quotationNo: data.quotation_no,
    refNo: data.ref_no,
    paymentTerms: data.payment_terms,
    invoiceCompanyName: data.invoice_to_company_name,
    invoiceAddress: data.invoice_to_address,
    issuedAt: data.issued_at,
    items: rawItems.map((item) => item as unknown as PurchaseOrderPdfTokenItem),
  };
}

export type PurchaseOrderExportSnapshot = {
  requisitionId: string;
  vendorName: string;
  vendorEmail: string;
  invoiceCompanyName: string;
  invoiceAddress: string;
  issuedAt: string;
  items: PurchaseOrderVendorItem[];
};

export async function getPurchaseOrderForExport(
  requisitionId: string,
): Promise<PurchaseOrderExportSnapshot | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_purchase_order_for_export", { p_requisition_id: requisitionId })
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const rawItems = Array.isArray(data.items) ? (data.items as Json[]) : [];
  return {
    requisitionId: data.requisition_id,
    vendorName: data.vendor_name,
    vendorEmail: data.vendor_email,
    invoiceCompanyName: data.invoice_to_company_name,
    invoiceAddress: data.invoice_to_address,
    issuedAt: data.issued_at,
    items: rawItems.map((item) => item as PurchaseOrderVendorItem),
  };
}

// The RPC joins only the awarded quote for each awarded requisition, applies
// search and filters before paging, and returns the total in the same query.
export async function getPurchaseOrders({
  page,
  pageSize,
  search,
  statuses,
  vessels,
  categories,
  datePreset,
  startDate,
  endDate,
}: {
  page: number;
  pageSize: number;
} & PurchaseOrderFilters): Promise<{ rows: PurchaseOrderListRow[]; total: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_purchase_orders", {
    p_search: search?.trim() ? search.trim() : null,
    p_statuses: statuses?.length ? statuses : null,
    p_vessels: vessels?.length ? vessels : null,
    p_categories: categories?.length ? categories : null,
    p_date_preset: datePreset ?? null,
    p_start_date: startDate ?? null,
    p_end_date: endDate ?? null,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) throw error;

  const rows: PurchaseOrderListRow[] = (data ?? []).map((row) => ({
    id: row.id,
    prNumber: row.pr_number,
    requisitionNumber: row.requisition_number,
    title: row.pr_title,
    vesselLabel: row.vessel_label,
    vendorName: row.vendor_name,
    vendorId: row.vendor_id ?? null,
    quoteReference: row.quote_reference,
    totalQuotedAmount: row.total_quoted_amount,
    quoteSubmittedAt: row.quote_submitted_at,
    status: row.status as PurchaseOrderStatus,
  }));

  return { rows, total: data?.[0]?.total_count ?? 0 };
}
