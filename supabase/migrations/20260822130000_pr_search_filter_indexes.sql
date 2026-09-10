-- Supporting indexes for the new PR search/filter feature. Before this,
-- purchase_requisitions had no index on status, purchase_requisition_dropdown_values
-- was only indexed on requisition_id (not field_id/option_value), and remarks
-- had no text-search index at all.
create index purchase_requisitions_status_idx
  on public.purchase_requisitions (status);

-- Lets the planner seek directly by (field_id, option_value) when a
-- vessel/category filter is applied via search_purchase_requisitions, rather
-- than scanning every dropdown-value row per requisition.
create index purchase_requisition_dropdown_values_field_value_idx
  on public.purchase_requisition_dropdown_values (field_id, option_value);

-- A plain btree can't accelerate a leading-wildcard `ilike '%term%'` (no
-- fixed prefix to seek on) — pg_trgm + GIN is the standard tool for that.
-- Bundled/standard Supabase extension, safe to enable.
create extension if not exists pg_trgm;

create index purchase_requisitions_remarks_trgm_idx
  on public.purchase_requisitions using gin (remarks gin_trgm_ops);
