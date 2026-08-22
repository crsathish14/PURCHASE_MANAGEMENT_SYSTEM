-- Single search/filter/paginate entry point for the PR list.
--
-- security invoker (not definer): this function touches nothing except
-- pr_requisition_list, and that view is itself definer-rights independent of
-- the caller's own security context (see 20260822060000) — so this is
-- privilege-equivalent to the plain client .from("pr_requisition_list")
-- query it replaces, just with filtering. No write RPC's SECURITY DEFINER
-- escalation is needed since there's nothing to write.
--
-- Every column reference is qualified `v.` because returns table(...)'s OUT
-- parameter names (id, status, ...) would otherwise collide with
-- pr_requisition_list's own column names of the same spelling — see
-- 20260822070000_fix_create_purchase_requisition_ambiguous_id.sql for the
-- prior bug this exact pattern caused.
--
-- The ref/pr_number branch uses plain lower(...) = lower(...) equality, not
-- ilike, so a literal '%'/'_' typed by a user can't turn "must be entered
-- completely" into an accidental wildcard match. The remarks branch does
-- legitimately need '%'/'_'/'\' escaping since it embeds user text between
-- wildcards for a partial match.
--
-- count(*) over() returns total+data in one round trip, at the cost of
-- Postgres evaluating the full matching set before paginating — the right
-- trade at this app's scale, not a free lunch. Because the total only
-- travels alongside actual output rows, a page past the end of a filtered
-- result set returns zero rows with no total attached at all; the frontend
-- retries at page 1 in that case rather than showing a misleading empty page.
--
-- p_page_size/offset are clamped since this function is directly callable
-- via .rpc() by any authenticated client, not only through the API route's
-- own already-validated page/pageSize.
create or replace function public.search_purchase_requisitions(
  p_search text default null,
  p_statuses public.pr_status[] default null,
  p_vessels text[] default null,
  p_categories text[] default null,
  p_page int default 1,
  p_page_size int default 20
)
returns table (
  id uuid,
  pr_number text,
  priority public.pr_priority,
  status public.pr_status,
  created_at timestamptz,
  vessel_label text,
  department_label text,
  category_label text,
  item_count bigint,
  requester_name text,
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
    count(*) over() as total_count
  from public.pr_requisition_list v
  where (p_statuses is null or cardinality(p_statuses) = 0 or v.status = any(p_statuses))
    and (p_vessels is null or cardinality(p_vessels) = 0 or v.vessel_value = any(p_vessels))
    and (p_categories is null or cardinality(p_categories) = 0 or v.category_value = any(p_categories))
    and (
      nullif(btrim(p_search), '') is null
      or v.remarks ilike '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or lower(v.pr_number) = lower(btrim(p_search))
    )
  order by v.created_at desc, v.id desc
  limit least(greatest(p_page_size, 1), 100)
  offset greatest((p_page - 1) * p_page_size, 0);
$$;

revoke all on function public.search_purchase_requisitions(
  text, public.pr_status[], text[], text[], int, int
) from public;
grant execute on function public.search_purchase_requisitions(
  text, public.pr_status[], text[], text[], int, int
) to authenticated;
