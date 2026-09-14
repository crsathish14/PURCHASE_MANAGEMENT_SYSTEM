-- get_rfq_quote_details_by_token now also returns the requisition's own
-- equipment_* fields (already populated for Spares/Service PRs via
-- create-requisition-dialog.tsx, but never selected by this function before)
-- so the Spares/Service vendor quote forms can render a pre-filled,
-- read-only Equipment Details section the same way the office-side form
-- already does.
--
-- p_token is unchanged, but the returns table shape is growing (7 trailing
-- columns) — Postgres refuses to change a function's return type via
-- CREATE OR REPLACE FUNCTION even with identical arguments (the same
-- situation already hit and documented in
-- 20260823150000_search_purchase_requisitions_rpc_requisition_number.sql),
-- so this needs drop-then-create. Confirmed via repo-wide search that this
-- function is called from exactly one place (src/lib/data/rfq-quote.ts),
-- so dropping it is safe. Grants do not survive a drop, so they're
-- re-issued below.
drop function public.get_rfq_quote_details_by_token(text);

create function public.get_rfq_quote_details_by_token(p_token text)
returns table (
  requisition_id uuid,
  pr_number text,
  vendor_name text,
  vendor_email text,
  expires_at timestamptz,
  submitted_at timestamptz,
  is_expired boolean,
  category text,
  requisition_date date,
  requested_by date,
  required_port text,
  vessel_label text,
  vessel_imo_no text,
  equipment_name text,
  equipment_type text,
  equipment_make text,
  equipment_serial_no text,
  equipment_model text,
  equipment_specifications text,
  equipment_other_details text,
  line_items jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    l.requisition_id,
    r.pr_number,
    l.vendor_name,
    l.vendor_email,
    l.expires_at,
    l.submitted_at,
    l.expires_at < now(),
    (
      select opt.value
      from public.purchase_requisition_dropdown_values dv
      join public.pr_dropdown_fields f on f.id = dv.field_id and f.key = 'category'
      join public.pr_dropdown_field_options opt on opt.field_id = dv.field_id and opt.value = dv.option_value
      where dv.requisition_id = r.id
    ),
    r.requisition_date,
    r.requested_by,
    r.required_port,
    (
      select opt.label
      from public.purchase_requisition_dropdown_values dv
      join public.pr_dropdown_fields f on f.id = dv.field_id and f.key = 'vessel'
      join public.pr_dropdown_field_options opt on opt.field_id = dv.field_id and opt.value = dv.option_value
      where dv.requisition_id = r.id
    ),
    (
      select v.imo_no
      from public.purchase_requisition_dropdown_values dv
      join public.pr_dropdown_fields f on f.id = dv.field_id and f.key = 'vessel'
      join public.pr_dropdown_field_options opt on opt.field_id = dv.field_id and opt.value = dv.option_value
      join public.vessels v on v.name = opt.label
      where dv.requisition_id = r.id
    ),
    r.equipment_name,
    r.equipment_type,
    r.equipment_make,
    r.equipment_serial_no,
    r.equipment_model,
    r.equipment_specifications,
    r.equipment_other_details,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'lineItemId', li.id,
            'description', li.description,
            'columns', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object('label', c.label, 'value', liv.value)
                  order by c.sort_order
                )
                from public.purchase_requisition_line_item_values liv
                join public.purchase_requisition_line_item_columns c on c.id = liv.column_id
                where liv.line_item_id = li.id
              ),
              '[]'::jsonb
            ),
            'attachments', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'fileName', a.file_name,
                    'contentType', a.content_type,
                    'storagePath', a.storage_path
                  )
                  order by a.sort_order
                )
                from public.purchase_requisition_line_item_attachments a
                where a.line_item_id = li.id
              ),
              '[]'::jsonb
            )
          )
          order by li.sort_order
        )
        from public.purchase_requisition_line_items li
        where li.requisition_id = r.id
      ),
      '[]'::jsonb
    )
  from public.purchase_requisition_rfq_links l
  join public.purchase_requisitions r on r.id = l.requisition_id
  where l.access_token = p_token;
end;
$$;

revoke all on function public.get_rfq_quote_details_by_token(text) from public;
grant execute on function public.get_rfq_quote_details_by_token(text) to anon, authenticated;
