-- Adds attachment-metadata persistence to update_purchase_requisition's existing
-- per-line-item insert loop, same treatment as create_purchase_requisition. True
-- in-place CREATE OR REPLACE (same name, same 10 argument types, same return
-- shape as the version from
-- 20260823130000_update_purchase_requisition_rpc_requisition_number.sql) — no
-- drop, so that migration's revoke/grant still applies.
--
-- Also explicitly deletes old attachment rows alongside the existing explicit
-- purchase_requisition_line_item_values delete, matching that statement's own
-- style, even though both are already redundant with the on delete cascade that
-- fires a few lines below when purchase_requisition_line_items rows are deleted.
create or replace function public.update_purchase_requisition(
  p_id uuid,
  p_priority public.pr_priority,
  p_requested_by date,
  p_required_port text,
  p_remarks text,
  p_requisition_number text,
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
      requisition_number = p_requisition_number
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
