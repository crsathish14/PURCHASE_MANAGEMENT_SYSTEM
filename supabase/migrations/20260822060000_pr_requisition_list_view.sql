-- Read path for the paginated PR list. A view (not an RPC) because
-- count:"exact" + .range() pagination only work against a
-- .from(table_or_view).select() target — an RPC's raw return has no
-- Content-Range header for PostgREST to compute pagination from.
--
-- 3 explicit joins (one per known key: vessel/department/category) plus a
-- correlated scalar subquery for item_count, not a pivot over the generic
-- dropdown_values table — keeps the view flat (best for .range()/
-- count:"exact") and directly implements the already-scoped "list shows
-- exactly these 3 fixed columns" decision.
--
-- Deliberately left at Postgres's default (security_invoker unset, i.e.
-- false): profiles_select_own only lets a user see their OWN profile row, so
-- a security_invoker view joining profiles would silently return null
-- Requester names for every PR the viewer didn't create. Left at the
-- default, this view's internal table access runs with the view OWNER's
-- privileges (the postgres role, which owns profiles and is not subject to
-- its own RLS — no migration has ever applied `force row level security` to
-- profiles), so every requester's name resolves regardless of who's asking.
-- This is safe because the SELECT list below only ever exposes
-- requester.full_name — never role/status/must_change_password — the same
-- "narrow derived value from a privileged read" pattern is_admin() already
-- uses elsewhere in this schema. A blanket
-- `profiles_select_authenticated using (true)` RLS policy was rejected as
-- the alternative: RLS is row-level, not column-level, so it would expose
-- every column of every profile, not just names.
--
-- Expect Supabase's dashboard Advisor to flag this as a "Security Definer
-- View" lint warning — that's a known false-positive-in-intent here; the
-- reasoning above is why it's deliberate.
create view public.pr_requisition_list as
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
  requester.full_name as requester_name
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

grant select on public.pr_requisition_list to authenticated;
