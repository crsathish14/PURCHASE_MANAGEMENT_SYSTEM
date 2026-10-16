-- Extend server-side Purchase Orders search with the same filters used by
-- Requested Quote. Search remains limited to PR ref, vendor, and quote ref;
-- vessel and category are explicit filters. Submission dates use the awarded
-- quote's created_at value shown in the list.
drop function public.search_purchase_orders(text, int, int);

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
      pr_list.vessel_label,
      pr_list.vessel_value,
      pr_list.category_value,
      quotation.vendor_name,
      coalesce(quotation.quotation_no, quotation.ref_no) as quote_reference,
      quotation.total_quoted_amount,
      quotation.created_at as quote_submitted_at,
      'pending_po'::text as status
    from public.purchase_requisitions pr
    join public.pr_requisition_list pr_list on pr_list.id = pr.id
    join public.purchase_requisition_rfq_quotations quotation
      on quotation.rfq_link_id = pr.awarded_rfq_link_id
      and quotation.requisition_id = pr.id
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
        or 'pending_po' = any(p_statuses)
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
