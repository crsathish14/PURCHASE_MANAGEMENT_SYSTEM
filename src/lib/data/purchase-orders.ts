import type { PurchaseOrderStatus } from "@/lib/constants/purchase-order";
import type { DatePreset } from "@/lib/constants/purchase-requisition";
import { createClient } from "@/lib/supabase/server";

export type PurchaseOrderListRow = {
  id: string;
  prNumber: string;
  vesselLabel: string | null;
  vendorName: string;
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
    vesselLabel: row.vessel_label,
    vendorName: row.vendor_name,
    quoteReference: row.quote_reference,
    totalQuotedAmount: row.total_quoted_amount,
    quoteSubmittedAt: row.quote_submitted_at,
    status: row.status as PurchaseOrderStatus,
  }));

  return { rows, total: data?.[0]?.total_count ?? 0 };
}
