-- Two fixes to duplicate_purchase_requisition:
--
-- 1. requisition_number (the free-text external/vessel number, distinct from
--    the auto-generated pr_number) was missing from the insert's column list
--    entirely, so a duplicate silently dropped it. Now copied straight
--    across, same as priority/requested_by/required_port/remarks already are.
--
-- 2. Line-item photos were deliberately NOT copied (see
--    20260822110000_duplicate_purchase_requisition_rpc.sql's comment) because
--    a plain row copy would point two DB rows at the same Storage object,
--    breaking one PR's photos whenever the other is deleted (route.ts's
--    DELETE handler removes the underlying Storage object per attachment
--    row). Actually copying the Storage object requires the Storage API,
--    which isn't reachable from plain SQL — so this stays a two-step flow:
--    this function now also returns an old-line-item-id -> new-line-item-id
--    map (mirroring the column-id map it already builds), and the route
--    handler uses that map to copy each source attachment's Storage object
--    to a fresh path before calling the new
--    duplicate_purchase_requisition_line_item_attachments below to persist
--    the copied rows. The return type is changing, so CREATE OR REPLACE
--    (which disallows that) needs a DROP first.
drop function if exists public.duplicate_purchase_requisition(uuid);

create function public.duplicate_purchase_requisition(p_id uuid)
returns table (id uuid, pr_number text, line_item_id_map jsonb)
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
  v_line_item_id_map jsonb := '{}'::jsonb;
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

  if v_src.status <> 'pending_rfq' then
    raise exception 'Only requisitions pending RFQ can be duplicated' using errcode = '55000';
  end if;

  insert into public.purchase_requisitions
    (priority, status, requested_by, required_port, remarks, requisition_number, created_by)
  values
    (v_src.priority, 'pending_rfq', v_src.requested_by, v_src.required_port, v_src.remarks,
     v_src.requisition_number, v_uid)
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

    v_line_item_id_map := v_line_item_id_map || jsonb_build_object(r.id::text, v_new_line_item_id::text);
  end loop;

  return query select v_new_id, v_new_pr_number, v_line_item_id_map;
end;
$$;

revoke all on function public.duplicate_purchase_requisition(uuid) from public;
grant execute on function public.duplicate_purchase_requisition(uuid) to authenticated;

-- Second step of the photo-copy flow above: persists attachment metadata
-- rows the route handler builds after it has already copied each source
-- object to a new Storage path (new requisition id, new line-item id, fresh
-- random file name — see PR_LINE_ITEM_PHOTO_PATH_PREFIX). Same "no
-- insert policy on this table, all writes go through a security-definer RPC"
-- trust model as create_purchase_requisition's own attachment insert loop;
-- this is that same insert, split out so the route can call it once the
-- Storage copies it depends on have actually finished.
create function public.duplicate_purchase_requisition_line_item_attachments(p_attachments jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_att jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  for v_att in select * from jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb)) loop
    insert into public.purchase_requisition_line_item_attachments
      (line_item_id, storage_path, file_name, content_type, size_bytes, sort_order)
    values (
      (v_att ->> 'lineItemId')::uuid,
      v_att ->> 'storagePath',
      v_att ->> 'fileName',
      v_att ->> 'contentType',
      (v_att ->> 'sizeBytes')::integer,
      coalesce((v_att ->> 'sortOrder')::integer, 0)
    );
  end loop;
end;
$$;

revoke all on function public.duplicate_purchase_requisition_line_item_attachments(jsonb) from public;
grant execute on function public.duplicate_purchase_requisition_line_item_attachments(jsonb) to authenticated;
