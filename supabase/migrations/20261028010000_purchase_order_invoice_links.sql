-- One invoice-request link per PO (after proforma received). No time-based
-- expiry — the link is invalidated only when the vendor submits.
create table public.purchase_order_invoice_links (
  id             uuid        primary key default gen_random_uuid(),
  requisition_id uuid        not null references public.purchase_requisitions(id),
  issuance_id    uuid        not null references public.purchase_order_issuances(id),
  access_token   text        not null unique default encode(gen_random_bytes(32), 'hex'),
  vendor_name    text        not null,
  vendor_email   text        not null,
  message        text,
  created_at     timestamptz not null default now(),
  submitted_at   timestamptz
);

-- Documents uploaded by the vendor: one mandatory invoice (document_type =
-- 'invoice') plus up to 5 supporting docs (document_type = 'supporting').
create table public.purchase_order_invoice_documents (
  id               uuid        primary key default gen_random_uuid(),
  invoice_link_id  uuid        not null references public.purchase_order_invoice_links(id) on delete cascade,
  document_type    text        not null check (document_type in ('invoice', 'supporting')),
  storage_path     text        not null,
  original_filename text       not null,
  sort_order       int         not null default 0,
  created_at       timestamptz not null default now()
);

alter table public.purchase_order_invoice_links    enable row level security;
alter table public.purchase_order_invoice_documents enable row level security;

create policy "Active staff can read invoice links"
  on public.purchase_order_invoice_links
  for select to authenticated using (true);

create policy "Active staff can read invoice documents"
  on public.purchase_order_invoice_documents
  for select to authenticated using (true);

grant select on public.purchase_order_invoice_links    to authenticated;
grant select on public.purchase_order_invoice_documents to authenticated;
