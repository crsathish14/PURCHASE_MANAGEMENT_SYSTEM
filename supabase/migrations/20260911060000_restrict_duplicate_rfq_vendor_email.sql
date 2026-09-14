-- Blocks issue_rfq_link from silently creating a second invite to the same
-- vendor email on the same requisition — Reissue (reissue_rfq_link,
-- 20260911040000) is the one deliberate, atomic path for "invite this same
-- vendor again" (it expires the old link first); a plain Issue RFQ to an
-- already-used email left the vendor with two simultaneously-live links to
-- the same PR, which pr_rfq_progress's distinct-vendor counting
-- (20260911030000) then correctly — but confusingly — collapses into "still
-- 1 vendor," making the fraction look stuck even though a second link was
-- created. This restriction prevents that state from ever existing, rather
-- than just explaining it away after the fact.
--
-- A distinct errcode (55001, not the existing 55000 "wrong requisition
-- status for this mutation") so the API layer can give a specific, more
-- helpful message than the generic conflict one — matches this schema's
-- existing precedent of a route having more than one conflict code (see
-- src/app/api/purchase-requisitions/[id]/route.ts's own comment on this).
--
-- vendor_email is compared case-sensitively, matching pr_rfq_progress's own
-- count(distinct vendor_email) — intentionally consistent rather than
-- normalizing case in only one of the two places that key off this column.
create or replace function public.issue_rfq_link(
  p_requisition_id uuid,
  p_vendor_name text,
  p_vendor_email text,
  p_expires_at timestamptz,
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

  if v_status not in ('pending_rfq', 'rfq_issued', 'quotes_received') then
    raise exception 'RFQ links can no longer be issued for this requisition' using errcode = '55000';
  end if;

  if exists (
    select 1 from public.purchase_requisition_rfq_links l
    where l.requisition_id = p_requisition_id
      and l.vendor_email = p_vendor_email
  ) then
    raise exception 'An RFQ has already been issued to this vendor for this requisition' using errcode = '55001';
  end if;

  if p_expires_at < now() then
    raise exception 'Expiry cannot be in the past' using errcode = '23514';
  end if;

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
