-- Terminal transition: quotes_received -> awarded, recording which vendor's
-- RFQ link won. Mirrors cancel_purchase_requisition's own auth/status-guard
-- shape (20260822100000_cancel_purchase_requisition_rpc.sql). Only one
-- vendor can ever be awarded per requisition — enforced by requiring the
-- current status to still be 'quotes_received' (an already-awarded or
-- cancelled requisition fails the same errcode 55000 cancel already uses for
-- "wrong status"), and only a link that actually has a submitted quote for
-- THIS requisition can be the target (55001 otherwise — e.g. a stale link id,
-- or one still Pending/Expired).
--
-- No changes needed to issue_rfq_link/reissue_rfq_link: both already refuse
-- to run once a requisition's status leaves their own allow-lists (neither
-- list includes 'awarded'), so they're already correctly blocked post-award
-- with zero code changes here.
create or replace function public.award_purchase_requisition(p_id uuid, p_rfq_link_id uuid)
returns table (id uuid, status public.pr_status, awarded_rfq_link_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status public.pr_status;
  v_link_requisition_id uuid;
  v_link_submitted_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  select purchase_requisitions.status into v_status
  from public.purchase_requisitions
  where purchase_requisitions.id = p_id;

  if v_status is null then
    raise exception 'Requisition not found' using errcode = 'P0002';
  end if;

  if v_status <> 'quotes_received' then
    raise exception 'This requisition cannot be awarded right now' using errcode = '55000';
  end if;

  select l.requisition_id, l.submitted_at into v_link_requisition_id, v_link_submitted_at
  from public.purchase_requisition_rfq_links l
  where l.id = p_rfq_link_id;

  if v_link_requisition_id is null or v_link_requisition_id <> p_id or v_link_submitted_at is null then
    raise exception 'Selected vendor has not submitted a quote for this requisition' using errcode = '55001';
  end if;

  update public.purchase_requisitions
  set status = 'awarded', awarded_rfq_link_id = p_rfq_link_id
  where purchase_requisitions.id = p_id and purchase_requisitions.status = 'quotes_received';

  return query
    select p_id, 'awarded'::public.pr_status, p_rfq_link_id;
end;
$$;

revoke all on function public.award_purchase_requisition(uuid, uuid) from public;
grant execute on function public.award_purchase_requisition(uuid, uuid) to authenticated;
