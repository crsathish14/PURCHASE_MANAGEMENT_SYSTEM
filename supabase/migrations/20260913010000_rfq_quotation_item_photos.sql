-- Storage for vendor-uploaded photos attached to a quoted line item — a
-- genuinely new concept from purchase_requisition_rfq_quotation_items itself
-- (which snapshots the office's own requested_description/etc., never
-- vendor-supplied files). One row per photo, ordered per item via
-- sort_order, cascading away with its owning quotation item (which itself
-- cascades from its quotation, which cascades from its rfq link) — same
-- cascade chain every sibling RFQ table already follows.
create table public.purchase_requisition_rfq_quotation_item_photos (
  id uuid primary key default gen_random_uuid(),
  quotation_item_id uuid not null references public.purchase_requisition_rfq_quotation_items (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text not null,
  size_bytes int not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index purchase_requisition_rfq_quotation_item_photos_item_id_idx
  on public.purchase_requisition_rfq_quotation_item_photos (quotation_item_id);

alter table public.purchase_requisition_rfq_quotation_item_photos enable row level security;

-- Same shape as every sibling purchase_requisition_rfq_quotation* table:
-- "any active user, app layer is the real gate" for reads, no anon policy
-- (the vendor never reads these back — the form just shows a "thank you"
-- screen post-submit), and no insert/update/delete policy at all — the only
-- write path is submit_rfq_quotation (security definer), see the sibling
-- migration in this same batch.
create policy "select_authenticated"
on public.purchase_requisition_rfq_quotation_item_photos
for select to authenticated using (true);
