import { createClient } from "@/lib/supabase/server";

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
