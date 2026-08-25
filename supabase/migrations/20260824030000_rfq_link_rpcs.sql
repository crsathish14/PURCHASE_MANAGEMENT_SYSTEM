-- issue_rfq_link: staff-only. Mirrors the auth.uid()/active-profile guard
-- used by every other staff RPC (duplicate_purchase_requisition,
-- cancel_purchase_requisition, delete_purchase_requisition). Allowed while
-- status is pending_rfq OR rfq_issued — issuing a second/third vendor's
-- link after the first one already flipped status to rfq_issued must keep
-- working. The status UPDATE below only touches rows still at
-- 'pending_rfq', so it's naturally a no-op for the 2nd+ vendor without any
-- special-casing.
create or replace function public.issue_rfq_link(
  p_requisition_id uuid,
  p_vendor_name text,
  p_vendor_email text,
  p_expires_at date,
  p_message text
)
returns table (id uuid, access_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status public.pr_status;
  v_id uuid;
  v_token text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  select purchase_requisitions.status into v_status
  from public.purchase_requisitions
  where purchase_requisitions.id = p_requisition_id;

  if v_status is null then
    raise exception 'Requisition not found' using errcode = 'P0002';
  end if;

  if v_status not in ('pending_rfq', 'rfq_issued') then
    raise exception 'RFQ links can no longer be issued for this requisition' using errcode = '55000';
  end if;

  -- Defense-in-depth behind the client-side Zod check — 23514
  -- (check_violation) is already one of this repo's established
  -- client-fixable-400 codes (see CLIENT_ERROR_PG_CODES in
  -- src/app/api/purchase-requisitions/[id]/route.ts).
  if p_expires_at < current_date then
    raise exception 'Expiry date cannot be in the past' using errcode = '23514';
  end if;

  -- Two concatenated gen_random_uuid()s — 64 hex chars, far more entropy
  -- than needed to be unguessable. Deliberately NOT gen_random_bytes()
  -- (pgcrypto): this schema has never enabled that extension, and since
  -- Supabase typically installs it into an `extensions` schema while every
  -- RPC here pins `search_path = public`, an unqualified gen_random_bytes()
  -- call risks failing to resolve. gen_random_uuid() is core Postgres,
  -- already relied on everywhere in this schema for every id column.
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.purchase_requisition_rfq_links
    (requisition_id, vendor_name, vendor_email, access_token, message, expires_at, created_by)
  values
    (p_requisition_id, p_vendor_name, p_vendor_email, v_token, p_message, p_expires_at, v_uid)
  returning purchase_requisition_rfq_links.id into v_id;

  update public.purchase_requisitions
  set status = 'rfq_issued'
  where purchase_requisitions.id = p_requisition_id
    and purchase_requisitions.status = 'pending_rfq';

  return query select v_id, v_token;
end;
$$;

revoke all on function public.issue_rfq_link(uuid, text, text, date, text) from public;
grant execute on function public.issue_rfq_link(uuid, text, text, date, text) to authenticated;

-- get_rfq_link_by_token: no auth check at all — called by an anonymous
-- vendor with zero session. Deliberately returns the row even when expired
-- or already submitted (rather than filtering in the WHERE clause) so the
-- calling page can distinguish "no such link" (zero rows) vs "expired" vs
-- "already submitted" and word the message accordingly. is_expired is
-- computed here, in SQL, against Postgres's own current_date — NOT
-- recomputed independently against Node's clock on the page — so there's a
-- single source of truth for "is this expired" instead of two runtimes
-- potentially disagreeing at a day boundary.
create or replace function public.get_rfq_link_by_token(p_token text)
returns table (
  requisition_id uuid,
  pr_number text,
  vendor_name text,
  expires_at date,
  submitted_at timestamptz,
  is_expired boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    l.requisition_id,
    r.pr_number,
    l.vendor_name,
    l.expires_at,
    l.submitted_at,
    l.expires_at < current_date
  from public.purchase_requisition_rfq_links l
  join public.purchase_requisitions r on r.id = l.requisition_id
  where l.access_token = p_token;
end;
$$;

revoke all on function public.get_rfq_link_by_token(text) from public;
grant execute on function public.get_rfq_link_by_token(text) to anon, authenticated;

-- submit_rfq_link: no auth check. The single-use guarantee lives entirely in
-- this one compound WHERE clause — "submitted_at is null and expires_at >=
-- current_date" — evaluated atomically by the UPDATE itself, so two
-- concurrent submits (or a submit landing exactly at the expiry boundary)
-- can't both succeed. Do NOT weaken this to a separate SELECT-then-UPDATE;
-- that would reopen the exact race this single statement closes.
-- expires_at >= current_date (not `>`) means a link is valid through the
-- entirety of its expiry calendar day, matching get_rfq_link_by_token's
-- is_expired definition above (both use `< current_date` / `>= current_date`
-- as exact complements).
create or replace function public.submit_rfq_link(p_token text)
returns table (success boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req_id uuid;
begin
  update public.purchase_requisition_rfq_links
  set submitted_at = now()
  where access_token = p_token
    and submitted_at is null
    and expires_at >= current_date
  returning requisition_id into v_req_id;

  -- Only the requisition's FIRST-ever vendor submission flips its status —
  -- the `where status = 'rfq_issued'` guard makes every subsequent vendor's
  -- (still-valid, still-single-use-for-them) submission a no-op here, since
  -- by then status is already 'quotes_received'.
  if v_req_id is not null then
    update public.purchase_requisitions
    set status = 'quotes_received'
    where purchase_requisitions.id = v_req_id
      and purchase_requisitions.status = 'rfq_issued';
  end if;

  return query select (v_req_id is not null);
end;
$$;

revoke all on function public.submit_rfq_link(text) from public;
grant execute on function public.submit_rfq_link(text) to anon, authenticated;
