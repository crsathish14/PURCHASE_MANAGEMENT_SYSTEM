-- Auto-saved, not-yet-submitted vendor quote form state. One row per RFQ
-- link (the link's access token is the vendor's only identity), holding the
-- form values and uploaded-photo metadata as a single jsonb blob — a draft is
-- always read and written whole and never queried by field, so a normalized
-- table would only add join cost for a 200+ line-item quote.
--
-- Reissuing a link deletes it (reissue_rfq_link), and the cascade removes its
-- draft with it — the vendor starts a reissued link from a blank form.
create table public.purchase_requisition_rfq_quote_drafts (
  rfq_link_id uuid        primary key references public.purchase_requisition_rfq_links(id) on delete cascade,
  draft       jsonb       not null,
  updated_at  timestamptz not null default now()
);

-- No policies and no grants: an anonymous vendor has no session for RLS to
-- scope, so the table is reachable only through the two security-definer
-- RPCs below (the same posture purchase_requisition_rfq_quotations takes for
-- its write path).
alter table public.purchase_requisition_rfq_quote_drafts enable row level security;

-- get_rfq_quote_draft: no auth check — called from the unauthenticated quote
-- page. Returns zero rows for an unknown, expired, or already-submitted link,
-- so a stale draft is never offered back once it can't be submitted.
create or replace function public.get_rfq_quote_draft(p_token text)
returns table (draft jsonb, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select d.draft, d.updated_at
  from public.purchase_requisition_rfq_quote_drafts d
  join public.purchase_requisition_rfq_links l on l.id = d.rfq_link_id
  where l.access_token = p_token
    and l.submitted_at is null
    and l.expires_at >= now();
end;
$$;

revoke all on function public.get_rfq_quote_draft(text) from public;
grant execute on function public.get_rfq_quote_draft(text) to anon, authenticated;

-- save_rfq_quote_draft: upserts the draft while the link can still be
-- submitted (not expired, not yet submitted). success = false means the link
-- is no longer usable and nothing was written. The payload's shape is
-- validated by the calling Route Handler (api/quote/[token]/draft).
create or replace function public.save_rfq_quote_draft(p_token text, p_draft jsonb)
returns table (success boolean, saved_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_id uuid;
  v_now timestamptz := now();
begin
  select l.id into v_link_id
  from public.purchase_requisition_rfq_links l
  where l.access_token = p_token
    and l.submitted_at is null
    and l.expires_at >= v_now;

  if v_link_id is null then
    return query select false, null::timestamptz;
    return;
  end if;

  insert into public.purchase_requisition_rfq_quote_drafts (rfq_link_id, draft, updated_at)
  values (v_link_id, p_draft, v_now)
  on conflict (rfq_link_id)
  do update set draft = excluded.draft, updated_at = excluded.updated_at;

  return query select true, v_now;
end;
$$;

revoke all on function public.save_rfq_quote_draft(text, jsonb) from public;
grant execute on function public.save_rfq_quote_draft(text, jsonb) to anon, authenticated;
