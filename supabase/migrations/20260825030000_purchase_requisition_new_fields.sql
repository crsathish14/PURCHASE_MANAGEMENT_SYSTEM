-- Adds the fields surfaced by comparing the official paper requisition forms
-- (FO G 011A Stores, FO G 011C Spares) against the live Create Requisition
-- form: a Requisition Date + Title header pair (distinct from the existing
-- Required By / Requisition Number), and a Spares-only Equipment Details
-- block ("Each Requisition should be for one Equipment only" per the source
-- form). All 9 columns are plain nullable text/date, following the same
-- direct-column-on-purchase_requisitions precedent as required_port/remarks
-- rather than a new child table — this is fixed 1:1 metadata, not a
-- repeatable owned entity.
alter table public.purchase_requisitions
  add column requisition_date date,
  add column title text,
  add column equipment_name text,
  add column equipment_type text,
  add column equipment_make text,
  add column equipment_serial_no text,
  add column equipment_model text,
  add column equipment_specifications text,
  add column equipment_other_details text;

-- Adding parameters changes the argument-type list, so per the existing
-- precedent (20260823120000_create_purchase_requisition_rpc_requisition_number.sql)
-- this is a genuine overload, not an in-place replace: the old 9-arg
-- signature is dropped first, then the 18-arg version is created and
-- re-granted (grants do not survive a drop).
drop function if exists public.create_purchase_requisition(
  public.pr_priority, date, text, text, text, jsonb, jsonb, jsonb, jsonb
);

create function public.create_purchase_requisition(
  p_priority public.pr_priority,
  p_requested_by date,
  p_required_port text,
  p_remarks text,
  p_requisition_number text,
  p_requisition_date date,
  p_title text,
  p_equipment_name text,
  p_equipment_type text,
  p_equipment_make text,
  p_equipment_serial_no text,
  p_equipment_model text,
  p_equipment_specifications text,
  p_equipment_other_details text,
  p_dropdowns jsonb,       -- {"vessel": "mv-aster", "department": "deck", "category": "stores"}
  p_custom_fields jsonb,   -- [{"label": "...", "value": "..."}]
  p_columns jsonb,         -- [{"key": "<client token>", "label": "Part no."}]
  p_line_items jsonb       -- [{"description": "...", "qty": "...", "extra": {"<token>": "..."}, "attachments": [...]}]
)
returns table (id uuid, pr_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_requisition_id uuid;
  v_pr_number text;
  v_column_id_map jsonb := '{}'::jsonb;
  v_field_id uuid;
  v_new_column_id uuid;
  v_line_item_id uuid;
  v_sort int;
  v_key text;
  v_val text;
  v_row jsonb;
  v_att jsonb;
  v_att_sort int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  insert into public.purchase_requisitions
    (priority, requested_by, required_port, remarks, requisition_number, requisition_date, title,
     equipment_name, equipment_type, equipment_make, equipment_serial_no, equipment_model,
     equipment_specifications, equipment_other_details, created_by)
  values
    (p_priority, p_requested_by, p_required_port, p_remarks, p_requisition_number, p_requisition_date,
     p_title, p_equipment_name, p_equipment_type, p_equipment_make, p_equipment_serial_no,
     p_equipment_model, p_equipment_specifications, p_equipment_other_details, v_uid)
  returning purchase_requisitions.id, purchase_requisitions.pr_number
    into v_requisition_id, v_pr_number;

  -- Belt-and-suspenders: the Route Handler already re-validates every
  -- dropdown field is present via buildCreateRequisitionSchema; this catches
  -- a caller that reaches the RPC directly.
  if exists (select 1 from public.pr_dropdown_fields f where not (p_dropdowns ? f.key)) then
    raise exception 'Missing a required dropdown field' using errcode = '23514';
  end if;

  for v_key, v_val in select key, value from jsonb_each_text(p_dropdowns) loop
    select f.id into v_field_id from public.pr_dropdown_fields f where f.key = v_key;
    if v_field_id is null then
      raise exception 'Unknown dropdown field: %', v_key using errcode = '23514';
    end if;
    insert into public.purchase_requisition_dropdown_values (requisition_id, field_id, option_value)
    values (v_requisition_id, v_field_id, v_val);
    -- an invalid option_value is rejected here by the composite FK.
  end loop;

  v_sort := 0;
  for v_row in select * from jsonb_array_elements(coalesce(p_custom_fields, '[]'::jsonb)) loop
    insert into public.purchase_requisition_custom_fields (requisition_id, label, value, sort_order)
    values (v_requisition_id, v_row ->> 'label', coalesce(v_row ->> 'value', ''), v_sort);
    v_sort := v_sort + 1;
  end loop;

  v_sort := 0;
  for v_row in select * from jsonb_array_elements(coalesce(p_columns, '[]'::jsonb)) loop
    insert into public.purchase_requisition_line_item_columns (requisition_id, label, sort_order)
    values (v_requisition_id, v_row ->> 'label', v_sort)
    returning purchase_requisition_line_item_columns.id into v_new_column_id;
    v_column_id_map := v_column_id_map || jsonb_build_object(v_row ->> 'key', v_new_column_id::text);
    v_sort := v_sort + 1;
  end loop;

  v_sort := 0;
  for v_row in select * from jsonb_array_elements(coalesce(p_line_items, '[]'::jsonb)) loop
    insert into public.purchase_requisition_line_items (requisition_id, description, qty, sort_order)
    values (v_requisition_id, coalesce(v_row ->> 'description', ''), coalesce(v_row ->> 'qty', ''), v_sort)
    returning purchase_requisition_line_items.id into v_line_item_id;

    for v_key, v_val in select key, value from jsonb_each_text(coalesce(v_row -> 'extra', '{}'::jsonb)) loop
      insert into public.purchase_requisition_line_item_values (line_item_id, column_id, value)
      values (v_line_item_id, (v_column_id_map ->> v_key)::uuid, v_val);
      -- a stray extra-key with no matching p_columns entry makes the lookup
      -- null; the not-null column_id constraint aborts the whole call.
    end loop;

    v_att_sort := 0;
    for v_att in select * from jsonb_array_elements(coalesce(v_row -> 'attachments', '[]'::jsonb)) loop
      insert into public.purchase_requisition_line_item_attachments
        (line_item_id, storage_path, file_name, content_type, size_bytes, sort_order)
      values (
        v_line_item_id,
        v_att ->> 'storagePath',
        v_att ->> 'fileName',
        v_att ->> 'contentType',
        (v_att ->> 'sizeBytes')::integer,
        v_att_sort
      );
      v_att_sort := v_att_sort + 1;
    end loop;

    v_sort := v_sort + 1;
  end loop;

  return query select v_requisition_id, v_pr_number;
end;
$$;

revoke all on function public.create_purchase_requisition
  (public.pr_priority, date, text, text, text, date, text, text, text, text, text, text, text, text,
   jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.create_purchase_requisition
  (public.pr_priority, date, text, text, text, date, text, text, text, text, text, text, text, text,
   jsonb, jsonb, jsonb, jsonb) to authenticated;

drop function if exists public.update_purchase_requisition(
  uuid, public.pr_priority, date, text, text, text, jsonb, jsonb, jsonb, jsonb
);

create function public.update_purchase_requisition(
  p_id uuid,
  p_priority public.pr_priority,
  p_requested_by date,
  p_required_port text,
  p_remarks text,
  p_requisition_number text,
  p_requisition_date date,
  p_title text,
  p_equipment_name text,
  p_equipment_type text,
  p_equipment_make text,
  p_equipment_serial_no text,
  p_equipment_model text,
  p_equipment_specifications text,
  p_equipment_other_details text,
  p_dropdowns jsonb,
  p_custom_fields jsonb,
  p_columns jsonb,
  p_line_items jsonb
)
returns table (id uuid, pr_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status public.pr_status;
  v_pr_number text;
  v_category_field_id uuid;
  v_existing_category text;
  v_new_category text;
  v_column_id_map jsonb := '{}'::jsonb;
  v_field_id uuid;
  v_new_column_id uuid;
  v_line_item_id uuid;
  v_sort int;
  v_key text;
  v_val text;
  v_row jsonb;
  v_att jsonb;
  v_att_sort int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  select purchase_requisitions.status into v_status
  from public.purchase_requisitions
  where purchase_requisitions.id = p_id;

  if v_status is null then
    raise exception 'Requisition not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending_rfq' then
    raise exception 'Only requisitions pending RFQ can be edited' using errcode = '55000';
  end if;

  if exists (select 1 from public.pr_dropdown_fields f where not (p_dropdowns ? f.key)) then
    raise exception 'Missing a required dropdown field' using errcode = '23514';
  end if;

  select f.id into v_category_field_id from public.pr_dropdown_fields f where f.key = 'category';
  select dv.option_value into v_existing_category
  from public.purchase_requisition_dropdown_values dv
  where dv.requisition_id = p_id and dv.field_id = v_category_field_id;
  v_new_category := p_dropdowns ->> 'category';
  if v_existing_category is not null and v_new_category is not null and v_existing_category <> v_new_category then
    raise exception 'Category cannot be changed after a requisition is created' using errcode = '55001';
  end if;

  update public.purchase_requisitions
  set priority = p_priority,
      requested_by = p_requested_by,
      required_port = p_required_port,
      remarks = p_remarks,
      requisition_number = p_requisition_number,
      requisition_date = p_requisition_date,
      title = p_title,
      equipment_name = p_equipment_name,
      equipment_type = p_equipment_type,
      equipment_make = p_equipment_make,
      equipment_serial_no = p_equipment_serial_no,
      equipment_model = p_equipment_model,
      equipment_specifications = p_equipment_specifications,
      equipment_other_details = p_equipment_other_details
  where purchase_requisitions.id = p_id
  returning purchase_requisitions.pr_number into v_pr_number;

  delete from public.purchase_requisition_line_item_attachments
  where line_item_id in (
    select li.id from public.purchase_requisition_line_items li where li.requisition_id = p_id
  );
  delete from public.purchase_requisition_line_item_values
  where line_item_id in (
    select li.id from public.purchase_requisition_line_items li where li.requisition_id = p_id
  );
  delete from public.purchase_requisition_line_items where requisition_id = p_id;
  delete from public.purchase_requisition_line_item_columns where requisition_id = p_id;
  delete from public.purchase_requisition_custom_fields where requisition_id = p_id;
  delete from public.purchase_requisition_dropdown_values where requisition_id = p_id;

  for v_key, v_val in select key, value from jsonb_each_text(p_dropdowns) loop
    select f.id into v_field_id from public.pr_dropdown_fields f where f.key = v_key;
    if v_field_id is null then
      raise exception 'Unknown dropdown field: %', v_key using errcode = '23514';
    end if;
    insert into public.purchase_requisition_dropdown_values (requisition_id, field_id, option_value)
    values (p_id, v_field_id, v_val);
    -- an invalid option_value is rejected here by the composite FK.
  end loop;

  v_sort := 0;
  for v_row in select * from jsonb_array_elements(coalesce(p_custom_fields, '[]'::jsonb)) loop
    insert into public.purchase_requisition_custom_fields (requisition_id, label, value, sort_order)
    values (p_id, v_row ->> 'label', coalesce(v_row ->> 'value', ''), v_sort);
    v_sort := v_sort + 1;
  end loop;

  v_sort := 0;
  for v_row in select * from jsonb_array_elements(coalesce(p_columns, '[]'::jsonb)) loop
    insert into public.purchase_requisition_line_item_columns (requisition_id, label, sort_order)
    values (p_id, v_row ->> 'label', v_sort)
    returning purchase_requisition_line_item_columns.id into v_new_column_id;
    v_column_id_map := v_column_id_map || jsonb_build_object(v_row ->> 'key', v_new_column_id::text);
    v_sort := v_sort + 1;
  end loop;

  v_sort := 0;
  for v_row in select * from jsonb_array_elements(coalesce(p_line_items, '[]'::jsonb)) loop
    insert into public.purchase_requisition_line_items (requisition_id, description, qty, sort_order)
    values (p_id, coalesce(v_row ->> 'description', ''), coalesce(v_row ->> 'qty', ''), v_sort)
    returning purchase_requisition_line_items.id into v_line_item_id;

    for v_key, v_val in select key, value from jsonb_each_text(coalesce(v_row -> 'extra', '{}'::jsonb)) loop
      insert into public.purchase_requisition_line_item_values (line_item_id, column_id, value)
      values (v_line_item_id, (v_column_id_map ->> v_key)::uuid, v_val);
    end loop;

    v_att_sort := 0;
    for v_att in select * from jsonb_array_elements(coalesce(v_row -> 'attachments', '[]'::jsonb)) loop
      insert into public.purchase_requisition_line_item_attachments
        (line_item_id, storage_path, file_name, content_type, size_bytes, sort_order)
      values (
        v_line_item_id,
        v_att ->> 'storagePath',
        v_att ->> 'fileName',
        v_att ->> 'contentType',
        (v_att ->> 'sizeBytes')::integer,
        v_att_sort
      );
      v_att_sort := v_att_sort + 1;
    end loop;

    v_sort := v_sort + 1;
  end loop;

  return query select p_id, v_pr_number;
end;
$$;

revoke all on function public.update_purchase_requisition
  (uuid, public.pr_priority, date, text, text, text, date, text, text, text, text, text, text, text,
   text, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.update_purchase_requisition
  (uuid, public.pr_priority, date, text, text, text, date, text, text, text, text, text, text, text,
   text, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- duplicate_purchase_requisition's own argument list (p_id uuid) and return
-- shape are unchanged, so a plain CREATE OR REPLACE covers copying the new
-- fields across too — no drop needed.
create or replace function public.duplicate_purchase_requisition(p_id uuid)
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
    (priority, status, requested_by, required_port, remarks, requisition_number, requisition_date,
     title, equipment_name, equipment_type, equipment_make, equipment_serial_no, equipment_model,
     equipment_specifications, equipment_other_details, created_by)
  values
    (v_src.priority, 'pending_rfq', v_src.requested_by, v_src.required_port, v_src.remarks,
     v_src.requisition_number, v_src.requisition_date, v_src.title, v_src.equipment_name,
     v_src.equipment_type, v_src.equipment_make, v_src.equipment_serial_no, v_src.equipment_model,
     v_src.equipment_specifications, v_src.equipment_other_details, v_uid)
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
