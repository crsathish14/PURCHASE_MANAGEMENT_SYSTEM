-- Photo attachments for Stores/Spares line items. Same normalized shape as every
-- other PR child table (20260822030000_purchase_requisitions_schema.sql) —
-- mirrors purchase_requisition_line_item_values specifically: FK straight to
-- purchase_requisition_line_items.id, on delete cascade, no requisition_id
-- denormalized here (a query scoping by requisition_id joins through line_items,
-- same as values already requires). Rows here are only ever created as a side
-- effect of create_purchase_requisition/update_purchase_requisition's per-line-item
-- insert loop (never inserted directly by client code — no insert policy below,
-- same as every sibling table) — update_purchase_requisition deletes+reinserts
-- these on every edit save, minting new ids; never rely on this table's own id
-- being stable across a save.
create table public.purchase_requisition_line_item_attachments (
  id uuid primary key default gen_random_uuid(),
  line_item_id uuid not null references public.purchase_requisition_line_items (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text not null,
  size_bytes integer not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index purchase_requisition_line_item_attachments_line_item_id_idx
  on public.purchase_requisition_line_item_attachments (line_item_id);

alter table public.purchase_requisition_line_item_attachments enable row level security;

create policy "purchase_requisition_line_item_attachments_select_authenticated"
on public.purchase_requisition_line_item_attachments for select to authenticated using (true);

-- No insert/update/delete policy — same reasoning as every sibling table in
-- 20260822040000_purchase_requisitions_rls.sql: all writes go through the
-- security-definer RPCs, so a client calling .insert() directly is rejected.
