-- Persists a vendor's submitted RFQ quotation — the "future update" the
-- vendorQuote.description copy on purchase_requisition_rfq_links has pointed
-- at since that table was introduced. Preserves the full chain this needs to
-- stay traceable through: PR -> RFQ link -> vendor quotation -> quoted items.
--
-- One quotation per RFQ link (rfq_link_id unique) — a link is already
-- single-use via its own submitted_at gate, so this is a strict 1:1.
-- requisition_id is denormalized from the link's own requisition_id purely
-- so "every quotation for this PR" is a direct query, not a join through
-- purchase_requisition_rfq_links every time.
create table public.purchase_requisition_rfq_quotations (
  id uuid primary key default gen_random_uuid(),
  rfq_link_id uuid not null unique references public.purchase_requisition_rfq_links (id) on delete cascade,
  requisition_id uuid not null references public.purchase_requisitions (id) on delete cascade,
  quotation_no text,
  ref_no text,
  vendor_name text not null,
  vendor_contact_person text,
  vendor_contact_no text,
  vendor_email text,
  vendor_other_details text,
  -- Always USD in this version — never accepted as a parameter from the
  -- vendor (see submit_rfq_quotation() in the next migration). The check
  -- constraint is a second, DB-level guarantee even if some future caller
  -- bypassed the RPC.
  currency text not null default 'USD' check (currency = 'USD'),
  -- Recalculated server-side from purchase_requisition_rfq_quotation_items
  -- on every submission, never trusted from anything the vendor submits.
  total_quoted_amount numeric(14, 2) not null default 0,
  quotation_validity text not null,
  payment_terms text not null,
  delivery_terms text not null,
  remarks_notes text not null,
  created_at timestamptz not null default now()
);

create index purchase_requisition_rfq_quotations_requisition_id_idx
  on public.purchase_requisition_rfq_quotations (requisition_id);

-- One row per PR line item the vendor was asked to quote. requested_description/
-- requested_impa_code/approved_qty/uom are a snapshot taken at submission time
-- (not just derived on read via line_item_id), so the quotation stays
-- traceable to exactly what was quoted against even though, in practice, a
-- PR's line items are already frozen the moment its RFQ is issued (the
-- update/delete/duplicate RPCs all block on status <> 'pending_rfq'). See
-- submit_rfq_quotation() for where this snapshot is taken from — always the
-- live PR data, never anything the vendor's own payload supplies for these
-- particular fields.
create table public.purchase_requisition_rfq_quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.purchase_requisition_rfq_quotations (id) on delete cascade,
  line_item_id uuid not null references public.purchase_requisition_line_items (id) on delete cascade,
  requested_description text not null,
  requested_impa_code text,
  approved_qty numeric,
  uom text,
  offered_description text,
  offered_impa_code text,
  unit_price numeric(14, 2),
  -- approved_qty * unit_price, computed server-side — null whenever either
  -- side is missing (an item the vendor left unpriced), never vendor-supplied.
  total_price numeric(14, 2),
  delivery_lead_time text,
  remarks text,
  sort_order int not null default 0
);

create index purchase_requisition_rfq_quotation_items_quotation_id_idx
  on public.purchase_requisition_rfq_quotation_items (quotation_id);
create index purchase_requisition_rfq_quotation_items_line_item_id_idx
  on public.purchase_requisition_rfq_quotation_items (line_item_id);

alter table public.purchase_requisition_rfq_quotations enable row level security;
alter table public.purchase_requisition_rfq_quotation_items enable row level security;

-- Same "any active user, app layer is the real gate" trust model as every
-- purchase_requisition_* sibling table.
create policy "purchase_requisition_rfq_quotations_select_authenticated"
on public.purchase_requisition_rfq_quotations for select
to authenticated
using (true);

create policy "purchase_requisition_rfq_quotation_items_select_authenticated"
on public.purchase_requisition_rfq_quotation_items for select
to authenticated
using (true);

-- No insert/update/delete policies, and deliberately no anon select policy
-- either, on either table — the one write path is submit_rfq_quotation()
-- (security definer, token-scoped, next migration), same reasoning as
-- purchase_requisition_rfq_links' own RLS comment: granting anon a direct
-- policy here would let anyone enumerate every submission by querying the
-- table directly instead of going through the one narrow, token-scoped RPC.
