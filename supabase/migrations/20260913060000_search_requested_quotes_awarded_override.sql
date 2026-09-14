-- search_requested_quotes' own derived_status output now shows "Awarded"
-- once a requisition has actually been awarded, overriding the vendor/quote-
-- count-derived value from pr_rfq_progress. pr_rfq_progress itself is left
-- untouched — it stays a pure vendor/quote-count concept (its own
-- derived_status never learns about purchase_requisitions.status) — this
-- override only happens here, at the point this RPC assembles what the
-- Requested Quote list page actually displays for a row, since that's the
-- one place PR_STATUS.AWARDED needs to be visible on this page (product
-- decision — the list previously kept these two concepts fully separate,
-- per this file's own REQUESTED_QUOTE_STATUS constant comment, but an
-- awarded requisition being shown mid-progress instead of concluded there
-- was confusing in practice).
--
-- Restructured as a CTE so the overridden value is computed once and reused
-- by both the SELECT list and the p_derived_statuses filter (a plain
-- inline `case` in the WHERE clause would otherwise have needed to repeat
-- the same expression, and filtering by "Awarded" wouldn't have matched
-- rows the SELECT itself labels as awarded). Every other clause is
-- unchanged from the original migration.
create or replace function public.search_requested_quotes(
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
  vessel_label text,
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
      v.id, v.pr_number, v.requisition_number, v.vessel_label,
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
    matched.id, matched.pr_number, matched.requisition_number, matched.vessel_label,
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
