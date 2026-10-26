-- Expose the PR title through the list view and its three paginated search
-- RPCs so each staff list can render it without an extra query per row.
create or replace view public.pr_requisition_list as
select
  pr.id,
  pr.pr_number,
  pr.priority,
  pr.status,
  pr.created_at,
  vessel_opt.label as vessel_label,
  dept_opt.label as department_label,
  category_opt.label as category_label,
  (select count(*) from public.purchase_requisition_line_items li
    where li.requisition_id = pr.id) as item_count,
  requester.full_name as requester_name,
  pr.remarks,
  vessel_dv.option_value as vessel_value,
  category_dv.option_value as category_value,
  pr.requisition_number,
  pr.title as pr_title
from public.purchase_requisitions pr
left join public.pr_dropdown_fields vessel_field on vessel_field.key = 'vessel'
left join public.purchase_requisition_dropdown_values vessel_dv
  on vessel_dv.requisition_id = pr.id and vessel_dv.field_id = vessel_field.id
left join public.pr_dropdown_field_options vessel_opt
  on vessel_opt.field_id = vessel_dv.field_id and vessel_opt.value = vessel_dv.option_value
left join public.pr_dropdown_fields dept_field on dept_field.key = 'department'
left join public.purchase_requisition_dropdown_values dept_dv
  on dept_dv.requisition_id = pr.id and dept_dv.field_id = dept_field.id
left join public.pr_dropdown_field_options dept_opt
  on dept_opt.field_id = dept_dv.field_id and dept_opt.value = dept_dv.option_value
left join public.pr_dropdown_fields category_field on category_field.key = 'category'
left join public.purchase_requisition_dropdown_values category_dv
  on category_dv.requisition_id = pr.id and category_dv.field_id = category_field.id
left join public.pr_dropdown_field_options category_opt
  on category_opt.field_id = category_dv.field_id and category_opt.value = category_dv.option_value
left join public.profiles requester on requester.id = pr.created_by;

-- The return type changed, so replace the function rather than using CREATE OR REPLACE.
drop function if exists public.search_purchase_requisitions(
  text, public.pr_status[], text[], text[], text, date, date, int, int
);

create function public.search_purchase_requisitions(
  p_search text default null,
  p_statuses public.pr_status[] default null,
  p_vessels text[] default null,
  p_categories text[] default null,
  p_date_preset text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_page int default 1,
  p_page_size int default 20
)
returns table (
  id uuid, pr_number text, priority public.pr_priority, status public.pr_status, created_at timestamptz,
  vessel_label text, department_label text, category_label text, item_count bigint, requester_name text,
  requisition_number text, pr_title text,
  total_count bigint
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    v.id, v.pr_number, v.priority, v.status, v.created_at,
    v.vessel_label, v.department_label, v.category_label, v.item_count, v.requester_name,
    v.requisition_number, v.pr_title,
    count(*) over() as total_count
  from public.pr_requisition_list v
  where (p_statuses is null or cardinality(p_statuses) = 0 or v.status = any(p_statuses))
    and (p_vessels is null or cardinality(p_vessels) = 0 or v.vessel_value = any(p_vessels))
    and (p_categories is null or cardinality(p_categories) = 0 or v.category_value = any(p_categories))
    and (
      nullif(btrim(p_search), '') is null
      or v.remarks ilike '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or v.requisition_number ilike '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or lower(v.pr_number) = lower(btrim(p_search))
    )
    and (
      p_date_preset is null
      or (p_date_preset = 'last_1_month' and v.created_at >= now() - interval '1 month')
      or (p_date_preset = 'last_3_months' and v.created_at >= now() - interval '3 months')
      or (p_date_preset = 'last_6_months' and v.created_at >= now() - interval '6 months')
      or (
        p_date_preset = 'custom'
        and p_start_date is not null and p_end_date is not null
        and v.created_at >= p_start_date::timestamptz
        and v.created_at < (p_end_date + 1)::timestamptz
      )
    )
  order by v.created_at desc, v.id desc
  limit least(greatest(p_page_size, 1), 100)
  offset greatest((p_page - 1) * p_page_size, 0);
$$;

revoke all on function public.search_purchase_requisitions(
  text, public.pr_status[], text[], text[], text, date, date, int, int
) from public;
grant execute on function public.search_purchase_requisitions(
  text, public.pr_status[], text[], text[], text, date, date, int, int
) to authenticated;

drop function public.search_requested_quotes(text, text[], text[], text[], text, date, date, int, int);

create function public.search_requested_quotes(
  p_search text default null,
  p_derived_statuses text[] default null,
  p_vessels text[] default null,
  p_categories text[] default null,
  p_date_preset text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_page int default 1,
  p_page_size int default 20
)
returns table (
  id uuid,
  pr_number text,
  requisition_number text,
  pr_title text,
  vessel_label text,
  category_label text,
  vendor_count bigint,
  quote_count bigint,
  derived_status text,
  first_issued_at timestamptz,
  total_count bigint
)
language sql
security invoker
set search_path = public
stable
as $$
  with matched as (
    select
      v.id, v.pr_number, v.requisition_number, v.pr_title, v.vessel_label, v.category_label,
      p.vendor_count, p.quote_count,
      case when v.status = 'awarded' then 'awarded_status' else p.derived_status end as derived_status,
      p.first_issued_at
    from public.pr_requisition_list v
    join public.pr_rfq_progress p on p.requisition_id = v.id
    where v.status <> 'cancelled'
      and (p_vessels is null or cardinality(p_vessels) = 0 or v.vessel_value = any(p_vessels))
      and (p_categories is null or cardinality(p_categories) = 0 or v.category_value = any(p_categories))
      and (
        nullif(btrim(p_search), '') is null
        or v.remarks ilike '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
        or v.requisition_number ilike '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
        or lower(v.pr_number) = lower(btrim(p_search))
      )
      and (
        p_date_preset is null
        or (p_date_preset = 'last_1_month' and p.first_issued_at >= now() - interval '1 month')
        or (p_date_preset = 'last_3_months' and p.first_issued_at >= now() - interval '3 months')
        or (p_date_preset = 'last_6_months' and p.first_issued_at >= now() - interval '6 months')
        or (
          p_date_preset = 'custom'
          and p_start_date is not null and p_end_date is not null
          and p.first_issued_at >= p_start_date::timestamptz
          and p.first_issued_at < (p_end_date + 1)::timestamptz
        )
      )
  )
  select
    matched.id, matched.pr_number, matched.requisition_number, matched.pr_title,
    matched.vessel_label, matched.category_label,
    matched.vendor_count, matched.quote_count, matched.derived_status, matched.first_issued_at,
    count(*) over() as total_count
  from matched
  where p_derived_statuses is null or cardinality(p_derived_statuses) = 0
    or matched.derived_status = any(p_derived_statuses)
  order by matched.first_issued_at desc, matched.id desc
  limit least(greatest(p_page_size, 1), 100)
  offset greatest((p_page - 1) * p_page_size, 0);
$$;

revoke all on function public.search_requested_quotes(
  text, text[], text[], text[], text, date, date, int, int
) from public;
grant execute on function public.search_requested_quotes(
  text, text[], text[], text[], text, date, date, int, int
) to authenticated;

drop function public.search_purchase_orders(text, text[], text[], text[], text, date, date, int, int);

create function public.search_purchase_orders(
  p_search text default null,
  p_statuses text[] default null,
  p_vessels text[] default null,
  p_categories text[] default null,
  p_date_preset text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_page int default 1,
  p_page_size int default 20
)
returns table (
  id uuid,
  pr_number text,
  requisition_number text,
  pr_title text,
  vessel_label text,
  vendor_name text,
  quote_reference text,
  total_quoted_amount numeric,
  quote_submitted_at timestamptz,
  status text,
  total_count bigint
)
language sql
security invoker
set search_path = public
stable
as $$
  with matched as (
    select
      pr.id,
      pr.pr_number,
      pr_list.requisition_number,
      pr_list.pr_title,
      pr_list.vessel_label,
      pr_list.vessel_value,
      pr_list.category_value,
      quotation.vendor_name,
      coalesce(quotation.quotation_no, quotation.ref_no) as quote_reference,
      quotation.total_quoted_amount,
      quotation.created_at as quote_submitted_at,
      case when issuance.requisition_id is null then 'pending_po'::text else 'po_issued'::text end as status
    from public.purchase_requisitions pr
    join public.pr_requisition_list pr_list on pr_list.id = pr.id
    join public.purchase_requisition_rfq_quotations quotation
      on quotation.rfq_link_id = pr.awarded_rfq_link_id
      and quotation.requisition_id = pr.id
    left join public.purchase_order_issuances issuance on issuance.requisition_id = pr.id
    where pr.status = 'awarded'
      and pr.awarded_rfq_link_id is not null
      and (
        nullif(btrim(p_search), '') is null
        or strpos(lower(coalesce(pr.pr_number, '')), lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(quotation.vendor_name, '')), lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(quotation.quotation_no, quotation.ref_no, '')), lower(btrim(p_search))) > 0
      )
      and (
        coalesce(cardinality(p_statuses), 0) = 0
        or (issuance.requisition_id is null and 'pending_po' = any(p_statuses))
        or (issuance.requisition_id is not null and 'po_issued' = any(p_statuses))
      )
      and (
        coalesce(cardinality(p_vessels), 0) = 0
        or pr_list.vessel_value = any(p_vessels)
      )
      and (
        coalesce(cardinality(p_categories), 0) = 0
        or pr_list.category_value = any(p_categories)
      )
      and (
        p_date_preset is null
        or (p_date_preset = 'last_1_month' and quotation.created_at >= now() - interval '1 month')
        or (p_date_preset = 'last_3_months' and quotation.created_at >= now() - interval '3 months')
        or (p_date_preset = 'last_6_months' and quotation.created_at >= now() - interval '6 months')
        or (
          p_date_preset = 'custom'
          and p_start_date is not null
          and p_end_date is not null
          and quotation.created_at >= p_start_date::timestamptz
          and quotation.created_at < (p_end_date + 1)::timestamptz
        )
      )
  )
  select
    matched.id,
    matched.pr_number,
    matched.requisition_number,
    matched.pr_title,
    matched.vessel_label,
    matched.vendor_name,
    matched.quote_reference,
    matched.total_quoted_amount,
    matched.quote_submitted_at,
    matched.status,
    count(*) over() as total_count
  from matched
  order by matched.quote_submitted_at desc, matched.id desc
  limit least(greatest(p_page_size, 1), 100)
  offset greatest((p_page - 1) * p_page_size, 0);
$$;

revoke all on function public.search_purchase_orders(text, text[], text[], text[], text, date, date, int, int) from public;
grant execute on function public.search_purchase_orders(text, text[], text[], text[], text, date, date, int, int) to authenticated;
