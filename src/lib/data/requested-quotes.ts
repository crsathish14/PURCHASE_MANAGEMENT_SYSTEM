import { createClient } from "@/lib/supabase/server";
import type { DatePreset } from "@/lib/constants/purchase-requisition";
import type { RequestedQuoteStatus } from "@/lib/constants/requested-quote";

export type RequestedQuoteListRow = {
  id: string;
  prNumber: string;
  requisitionNumber: string | null;
  vesselLabel: string | null;
  categoryLabel: string | null;
  vendorCount: number;
  quoteCount: number;
  derivedStatus: RequestedQuoteStatus;
  firstIssuedAt: string;
};

export type RequestedQuoteFilters = {
  search?: string;
  statuses?: RequestedQuoteStatus[];
  vessels?: string[];
  categories?: string[];
  datePreset?: DatePreset;
  startDate?: string;
  endDate?: string;
};

// Goes through search_requested_quotes (not a plain .from(view).select()) for
// the same reasons getPurchaseRequisitions does: filtering happens
// server-side with existing indexes, and total count comes back in the same
// round trip via a count(*) over() window column — see the migration for the
// full rationale, including why only PRs with >= 1 issued RFQ link can ever
// be returned (a join, not a WHERE clause) and why cancelled PRs are always
// excluded.
export async function getRequestedQuotes({
  page,
  pageSize,
  search,
  statuses,
  vessels,
  categories,
  datePreset,
  startDate,
  endDate,
}: { page: number; pageSize: number } & RequestedQuoteFilters): Promise<{
  rows: RequestedQuoteListRow[];
  total: number;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_requested_quotes", {
    p_search: search?.trim() ? search.trim() : null,
    p_derived_statuses: statuses?.length ? statuses : null,
    p_vessels: vessels?.length ? vessels : null,
    p_categories: categories?.length ? categories : null,
    p_date_preset: datePreset ?? null,
    p_start_date: startDate ?? null,
    p_end_date: endDate ?? null,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) throw error;

  const rows: RequestedQuoteListRow[] = (data ?? []).map((row) => ({
    id: row.id,
    prNumber: row.pr_number,
    requisitionNumber: row.requisition_number,
    vesselLabel: row.vessel_label,
    categoryLabel: row.category_label,
    vendorCount: row.vendor_count,
    quoteCount: row.quote_count,
    derivedStatus: row.derived_status as RequestedQuoteStatus,
    firstIssuedAt: row.first_issued_at,
  }));

  return { rows, total: data?.[0]?.total_count ?? 0 };
}
