-- search_requested_quotes: the Requested Quote list page's equivalent of
-- search_purchase_requisitions (20260823150000) — same shape (search +
-- multi-value filters + a date-preset/custom-range filter + page/pageSize +
-- a count(*) over() total_count column in the same round trip), but joined
-- to pr_rfq_progress (20260911010000) so only PRs with >= 1 issued RFQ link
-- are ever reachable — that join is what enforces "appears only after an
-- RFQ has been issued to at least one vendor," not a WHERE clause here.
--
-- Cancelled PRs are excluded outright (status <> 'cancelled'), even if they
-- had RFQs issued before being cancelled — a confirmed product decision:
-- this page tracks the active quote-gathering pipeline, not a full
-- historical record.
--
-- p_derived_statuses filters against pr_rfq_progress's own precomputed
-- derived_status, never against purchase_requisitions.status — that column
-- alone can't distinguish "1 of 3 vendors responded" from "3 of 3" (both
-- read as 'quotes_received'), which is the whole reason pr_rfq_progress
-- exists.
--
-- The date filter runs against first_issued_at (earliest RFQ link issued
-- for that PR), not the PR's own created_at, since first_issued_at is this
-- page's own displayed, primary date column — "Last 3 months" etc. should
-- filter on what the user actually sees in that column, mirroring how
-- search_purchase_requisitions filters its own date presets against THAT
-- page's primary date column (created_at).
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
  select
    v.id, v.pr_number, v.requisition_number, v.vessel_label,
    p.vendor_count, p.quote_count, p.derived_status, p.first_issued_at,
    count(*) over() as total_count
  from public.pr_requisition_list v
  join public.pr_rfq_progress p on p.requisition_id = v.id
  where v.status <> 'cancelled'
    and (p_vessels is null or cardinality(p_vessels) = 0 or v.vessel_value = any(p_vessels))
    and (p_categories is null or cardinality(p_categories) = 0 or v.category_value = any(p_categories))
    and (p_derived_statuses is null or cardinality(p_derived_statuses) = 0 or p.derived_status = any(p_derived_statuses))
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
  order by p.first_issued_at desc, v.id desc
  limit least(greatest(p_page_size, 1), 100)
  offset greatest((p_page - 1) * p_page_size, 0);
$$;

revoke all on function public.search_requested_quotes(
  text, text[], text[], text[], text, date, date, int, int
) from public;
grant execute on function public.search_requested_quotes(
  text, text[], text[], text[], text, date, date, int, int
) to authenticated;
