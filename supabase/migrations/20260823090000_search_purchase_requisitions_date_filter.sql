-- Adds date-range filtering (rolling presets + custom range) to
-- search_purchase_requisitions. Adding parameters changes the function's
-- argument-type signature, so this is a genuine overload, not an in-place
-- replace: CREATE OR REPLACE with a different arg list would leave the old
-- 6-arg version registered alongside the new one, and PostgREST's .rpc()
-- could then hit "could not choose a best candidate function". The old
-- signature is dropped first, then the new one is created and re-granted
-- (grants do not survive a drop).
drop function if exists public.search_purchase_requisitions(
  text, public.pr_status[], text[], text[], int, int
);

create or replace function public.search_purchase_requisitions(
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
    -- p_date_preset is validated/coerced by the API route against a fixed
    -- allow-list before this RPC ever sees it — an unrecognized value here
    -- matches none of the branches below and would silently exclude every
    -- row, same failure mode an unvalidated p_statuses entry would have.
    -- 'custom' additionally requires both dates to be non-null; the route
    -- only ever sends 'custom' once it has validated both are present.
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
