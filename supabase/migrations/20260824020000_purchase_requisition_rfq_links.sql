-- One row per vendor per issued RFQ link — NOT per-PR. Each vendor gets a
-- distinct access_token (links are never shared across vendors), so
-- re-issuing to a second vendor for the same PR is a second row, not an
-- update to the first. expires_at is `date`, not `timestamptz` — it's
-- picked via a plain <input type="date">, same as
-- purchase_requisitions.requested_by, and reusing that precedent avoids
-- inventing a "what time of day does the picked date expire at" conversion
-- with no existing convention to follow.
create table public.purchase_requisition_rfq_links (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.purchase_requisitions (id) on delete cascade,
  vendor_name text not null,
  vendor_email text not null,
  access_token text not null unique,
  message text not null,
  expires_at date not null,
  -- null = not yet consumed. Set exactly once, by submit_rfq_link()'s atomic
  -- "where submitted_at is null" update — this column IS the single-use gate.
  submitted_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

-- access_token already has a unique index from the `unique` constraint above
-- — no separate index needed for token lookups. requisition_id gets its
-- own, matching every sibling purchase_requisition_* child table's own FK
-- index.
create index purchase_requisition_rfq_links_requisition_id_idx
  on public.purchase_requisition_rfq_links (requisition_id);

alter table public.purchase_requisition_rfq_links enable row level security;

-- Same "any active user, app layer is the real gate" trust model as every
-- purchase_requisition_* sibling table.
create policy "purchase_requisition_rfq_links_select_authenticated"
on public.purchase_requisition_rfq_links for select
to authenticated
using (true);

-- No insert/update/delete policies, and deliberately no anon select policy
-- either — every write goes through issue_rfq_link() (staff-only) or
-- submit_rfq_link() (public), both security definer. The anonymous vendor's
-- read path is get_rfq_link_by_token(), also security definer, which
-- bypasses RLS entirely from inside the function rather than needing an
-- anon-facing SELECT policy on this table — granting anon a direct SELECT
-- policy here would let anyone enumerate every row/token by querying the
-- table itself instead of going through the one narrow, token-scoped
-- function.
