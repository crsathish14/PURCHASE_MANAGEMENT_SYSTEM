-- A manually-typed, non-unique reference number distinct from pr_number (the
-- system-generated "Ref"). Lets staff cross-reference an external/paper
-- requisition document; partial-searchable from the list (see the
-- search_purchase_requisitions update). Nullable, no default — same
-- treatment as required_port/remarks.
alter table public.purchase_requisitions add column requisition_number text;
