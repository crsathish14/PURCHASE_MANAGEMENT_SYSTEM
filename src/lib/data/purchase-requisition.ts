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

export type PrDetail = {
  id: string;
  prNumber: string;
  status: PrStatus;
  priority: PrPriority;
  requestedBy: string | null;
  requiredPort: string | null;
  remarks: string | null;
  dropdowns: Record<string, string>;
  customFields: Array<{ label: string; value: string }>;
  columns: Array<{ key: string; label: string }>;
  lineItems: Array<{ description: string; qty: string; extra: Record<string, string> }>;
};

// Full detail for the edit/read-only modal — unlike pr_requisition_list
// (list-page summary only), this reads the 5 child tables directly. Each
// column's own id (stringified) doubles as its client-side "key" so
// lineItems[].extra can be correlated with columns[] within one submitted
// payload — update_purchase_requisition always deletes and reinserts columns
// on every save, so the key never needs to persist across saves.
export async function getPurchaseRequisitionById(id: string): Promise<PrDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_requisitions")
    .select(
      `
      id, pr_number, status, priority, requested_by, required_port, remarks,
      purchase_requisition_dropdown_values ( option_value, pr_dropdown_fields ( key ) ),
      purchase_requisition_custom_fields ( label, value, sort_order ),
      purchase_requisition_line_item_columns ( id, label, sort_order ),
      purchase_requisition_line_items (
        id, description, qty, sort_order,
        purchase_requisition_line_item_values ( column_id, value )
      )
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const dropdowns = Object.fromEntries(
    (data.purchase_requisition_dropdown_values ?? [])
      .filter((row) => row.pr_dropdown_fields)
      .map((row) => [row.pr_dropdown_fields!.key, row.option_value]),
  );

  const customFields = [...(data.purchase_requisition_custom_fields ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({ label: row.label, value: row.value }));

  const columns = [...(data.purchase_requisition_line_item_columns ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({ key: row.id, label: row.label }));

  const lineItems = [...(data.purchase_requisition_line_items ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({
      description: row.description,
      qty: row.qty,
      extra: Object.fromEntries(
        (row.purchase_requisition_line_item_values ?? []).map((value) => [value.column_id, value.value]),
      ),
    }));

  return {
    id: data.id,
    prNumber: data.pr_number,
    status: data.status,
    priority: data.priority,
    requestedBy: data.requested_by,
    requiredPort: data.required_port,
    remarks: data.remarks,
    dropdowns,
    customFields,
    columns,
    lineItems,
  };
}
