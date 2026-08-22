import { createClient } from "@/lib/supabase/server";
import type { PrPriority, PrStatus } from "@/lib/constants/purchase-requisition";

export type PrDropdownFieldOption = {
  value: string;
  label: string;
};

export type PrDropdownField = {
  key: string;
  label: string;
  options: PrDropdownFieldOption[];
};

// Any authenticated user can read this reference data (pr_dropdown_fields_select_authenticated /
// pr_dropdown_field_options_select_authenticated) — it's non-sensitive, and both admin and
// Purchase Officer roles need it to fill the Create Requisition form.
export async function getPrDropdownFields(): Promise<PrDropdownField[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pr_dropdown_fields")
    .select("key, label, sort_order, pr_dropdown_field_options(value, label, sort_order)")
    .order("sort_order", { ascending: true })
    .order("sort_order", { referencedTable: "pr_dropdown_field_options", ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    key: row.key,
    label: row.label,
    options: (row.pr_dropdown_field_options ?? []).map((option) => ({
      value: option.value,
      label: option.label,
    })),
  }));
}

export type PrListRow = {
  id: string;
  prNumber: string;
  priority: PrPriority;
  status: PrStatus;
  createdAt: string;
  vesselLabel: string | null;
  departmentLabel: string | null;
  categoryLabel: string | null;
  itemCount: number;
  requesterName: string | null;
};

// pr_requisition_list is a view (not a table) so pagination gets total count
// in the same round trip via count:"exact" — see the migration comment on
// why it's deliberately left at security_invoker=false to resolve every
// requester's name regardless of the viewing user's own profiles RLS.
export async function getPurchaseRequisitions({
  page,
  pageSize,
}: {
  page: number;
  pageSize: number;
}): Promise<{ rows: PrListRow[]; total: number }> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const { data, error, count } = await supabase
    .from("pr_requisition_list")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw error;

  const rows: PrListRow[] = (data ?? []).map((row) => ({
    id: row.id,
    prNumber: row.pr_number,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
    vesselLabel: row.vessel_label,
    departmentLabel: row.department_label,
    categoryLabel: row.category_label,
    itemCount: row.item_count,
    requesterName: row.requester_name,
  }));

  return { rows, total: count ?? 0 };
}
