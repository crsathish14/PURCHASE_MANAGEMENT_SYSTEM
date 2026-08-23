-- Adds attachment-metadata persistence to create_purchase_requisition's existing
-- per-line-item insert loop — same nested-loop treatment the loop already gives
-- each line item's `extra` map (-> purchase_requisition_line_item_values), applied
-- to a new `attachments` array per line item
-- (-> purchase_requisition_line_item_attachments). No new argument: the client
-- payload already carries this inside p_line_items (each element gains an
-- `attachments` key) — true in-place CREATE OR REPLACE (same name, same argument
-- types, same return shape as the 9-arg version from
-- 20260823120000_create_purchase_requisition_rpc_requisition_number.sql), so
-- that migration's revoke/grant still applies and isn't repeated here.
--
-- Deliberately NOT creating attachment rows at upload time (see api/uploads/sign)
-- — no real line_item_id exists until this very insert, so a photo picked before
-- Submit can only be described by its Storage path/metadata in the payload, never
-- by a DB row, until this loop runs.
create or replace function public.create_purchase_requisition(
  p_priority public.pr_priority,
  p_requested_by date,
  p_required_port text,
  p_remarks text,
  p_requisition_number text,
  p_dropdowns jsonb,       -- {"vessel": "mv-aster", "department": "deck", "category": "stores"}
  p_custom_fields jsonb,   -- [{"label": "...", "value": "..."}]
  p_columns jsonb,         -- [{"key": "<client token>", "label": "Part no."}]
  p_line_items jsonb       -- [{"description": "...", "qty": "...", "extra": {"<token>": "..."}, "attachments": [{"storagePath": "...", "fileName": "...", "contentType": "...", "sizeBytes": 123}]}]
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

  -- Defense-in-depth: requireApiActiveUser() already checked this at the
  -- Next.js layer, but this RPC is independently callable via Supabase's own
  -- REST endpoint with any valid session.
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  insert into public.purchase_requisitions
    (priority, requested_by, required_port, remarks, requisition_number, created_by)
  values (p_priority, p_requested_by, p_required_port, p_remarks, p_requisition_number, v_uid)
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

    -- New: mirrors the extra loop just above, one row per already-uploaded
    -- Storage object this line item is keeping. storagePath/fileName/
    -- contentType/sizeBytes are plain descriptive metadata about an object
    -- api/uploads/sign already signed and the client already PUT — nothing
    -- here touches Storage itself.
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
