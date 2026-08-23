-- Mirrors purchase_requisitions_remarks_trgm_idx (20260822130000) for the new
-- requisition_number partial search — a plain btree can't accelerate a
-- leading-wildcard `ilike '%term%'`. pg_trgm is already enabled.
create index purchase_requisitions_requisition_number_trgm_idx
  on public.purchase_requisitions using gin (requisition_number gin_trgm_ops);
