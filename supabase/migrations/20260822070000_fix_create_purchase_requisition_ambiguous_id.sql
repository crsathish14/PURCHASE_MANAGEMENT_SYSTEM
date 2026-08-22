-- Fixes a bug in 20260822050000_create_purchase_requisition_rpc.sql found
-- during verification: `where id = v_uid` was unqualified, and since the
-- function's own `returns table (id uuid, pr_number text)` declares an OUT
-- parameter also named `id`, Postgres raised "column reference id is
-- ambiguous" on every call. Qualifying the column reference (`p.id`) via a
-- table alias fixes it — no other part of the function had this issue (every
-- other `id` reference already went through a RETURNING clause qualified
-- with its full table name, or a joined alias like `f.id`).
create or replace function public.create_purchase_requisition(
  p_priority public.pr_priority,
  p_requested_by date,
  p_required_port text,
  p_remarks text,
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
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  insert into public.purchase_requisitions (priority, requested_by, required_port, remarks, created_by)
  values (p_priority, p_requested_by, p_required_port, p_remarks, v_uid)
  returning purchase_requisitions.id, purchase_requisitions.pr_number
    into v_requisition_id, v_pr_number;

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
    end loop;
    v_sort := v_sort + 1;
  end loop;

  return query select v_requisition_id, v_pr_number;
end;
$$;

revoke all on function public.create_purchase_requisition
  (public.pr_priority, date, text, text, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.create_purchase_requisition
  (public.pr_priority, date, text, text, jsonb, jsonb, jsonb, jsonb) to authenticated;
