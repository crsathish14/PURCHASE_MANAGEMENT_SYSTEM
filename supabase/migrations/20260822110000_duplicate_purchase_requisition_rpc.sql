-- Full duplicate: a fresh id/pr_number/created_by/created_at, status reset to
-- 'pending_rfq', but the same priority/requested_by/required_port/remarks
-- and every dropdown selection, custom field, line-item column, and
-- line-item value copied straight across from the source PR. Line-item
-- columns get new ids (their old-id -> new-id map mirrors the client-token
-- map create_purchase_requisition already builds for brand-new columns), so
-- their values are remapped rather than copied by column_id directly.
--
-- Deliberately does NOT copy purchase_requisition_line_item_attachments — a
-- duplicated PR's (copied) line items start with zero photos. Known v1
-- limitation, not an oversight: duplicating a photo would mean copying the
-- underlying Storage object too (a plain row copy would leave two DB rows
-- pointing at the same storage_path, so deleting either PR would orphan or
-- break the other's photo), which is out of scope for this pass.
create or replace function public.duplicate_purchase_requisition(p_id uuid)
returns table (id uuid, pr_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_src public.purchase_requisitions%rowtype;
  v_new_id uuid;
  v_new_pr_number text;
  v_column_id_map jsonb := '{}'::jsonb;
  v_new_column_id uuid;
  v_new_line_item_id uuid;
  r record;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  select * into v_src from public.purchase_requisitions where purchase_requisitions.id = p_id;
  if v_src.id is null then
    raise exception 'Requisition not found' using errcode = 'P0002';
  end if;

  insert into public.purchase_requisitions (priority, status, requested_by, required_port, remarks, created_by)
  values (v_src.priority, 'pending_rfq', v_src.requested_by, v_src.required_port, v_src.remarks, v_uid)
  returning purchase_requisitions.id, purchase_requisitions.pr_number into v_new_id, v_new_pr_number;

  insert into public.purchase_requisition_dropdown_values (requisition_id, field_id, option_value)
  select v_new_id, field_id, option_value
  from public.purchase_requisition_dropdown_values
  where requisition_id = p_id;

  insert into public.purchase_requisition_custom_fields (requisition_id, label, value, sort_order)
  select v_new_id, label, value, sort_order
  from public.purchase_requisition_custom_fields
  where requisition_id = p_id;

  for r in
    select * from public.purchase_requisition_line_item_columns
    where requisition_id = p_id
    order by sort_order
  loop
    insert into public.purchase_requisition_line_item_columns (requisition_id, label, sort_order)
    values (v_new_id, r.label, r.sort_order)
    returning purchase_requisition_line_item_columns.id into v_new_column_id;
    v_column_id_map := v_column_id_map || jsonb_build_object(r.id::text, v_new_column_id::text);
  end loop;

  for r in
    select * from public.purchase_requisition_line_items
    where requisition_id = p_id
    order by sort_order
  loop
    insert into public.purchase_requisition_line_items (requisition_id, description, qty, sort_order)
    values (v_new_id, r.description, r.qty, r.sort_order)
    returning purchase_requisition_line_items.id into v_new_line_item_id;

    insert into public.purchase_requisition_line_item_values (line_item_id, column_id, value)
    select v_new_line_item_id, (v_column_id_map ->> liv.column_id::text)::uuid, liv.value
    from public.purchase_requisition_line_item_values liv
    where liv.line_item_id = r.id;
  end loop;

  return query select v_new_id, v_new_pr_number;
end;
$$;

revoke all on function public.duplicate_purchase_requisition(uuid) from public;
grant execute on function public.duplicate_purchase_requisition(uuid) to authenticated;
