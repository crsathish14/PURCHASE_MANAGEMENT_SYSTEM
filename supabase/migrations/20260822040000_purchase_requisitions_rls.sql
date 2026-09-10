alter table public.purchase_requisitions enable row level security;
alter table public.purchase_requisition_dropdown_values enable row level security;
alter table public.purchase_requisition_custom_fields enable row level security;
alter table public.purchase_requisition_line_items enable row level security;
alter table public.purchase_requisition_line_item_columns enable row level security;
alter table public.purchase_requisition_line_item_values enable row level security;

-- Non-sensitive shared company data — every request raised across the fleet
-- is visible to any active user (admin or officer), same reasoning
-- pr_dropdown_fields already uses: the real gate is requireActiveUser() at
-- the page level, not RLS.
create policy "purchase_requisitions_select_authenticated"
on public.purchase_requisitions for select to authenticated using (true);

create policy "purchase_requisition_dropdown_values_select_authenticated"
on public.purchase_requisition_dropdown_values for select to authenticated using (true);

create policy "purchase_requisition_custom_fields_select_authenticated"
on public.purchase_requisition_custom_fields for select to authenticated using (true);

create policy "purchase_requisition_line_items_select_authenticated"
on public.purchase_requisition_line_items for select to authenticated using (true);

create policy "purchase_requisition_line_item_columns_select_authenticated"
on public.purchase_requisition_line_item_columns for select to authenticated using (true);

create policy "purchase_requisition_line_item_values_select_authenticated"
on public.purchase_requisition_line_item_values for select to authenticated using (true);

-- No insert/update/delete policies on any of the 6 tables — deliberate,
-- matching profiles' own precedent ("inserts happen only via the
-- security-definer trigger"). Every write goes through
-- create_purchase_requisition() (a security definer RPC), so a client
-- calling .insert() directly is correctly rejected by RLS.
