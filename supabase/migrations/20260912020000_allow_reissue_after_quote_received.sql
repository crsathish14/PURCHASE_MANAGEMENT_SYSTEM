-- reissue_rfq_link no longer refuses to reissue a link whose vendor already
-- submitted a quote. Product decision: an officer may need a revised quote
-- from a vendor who already responded (pricing changed, items added, etc.)
-- — Reissue is now the supported path for that too, not just for recovering
-- a stale/expired invite. The frontend (rfq-links-dialog.tsx) shows an
-- explicit warning dialog before calling this RPC in that case, since the
-- vendor's already-submitted quotation is genuinely lost: deleting the old
-- link (below, unchanged from 20260912010000_reissue_deletes_old_link.sql)
-- cascades away its purchase_requisition_rfq_quotations row
-- (rfq_link_id ... on delete cascade, 20260830010000) along with every
-- purchase_requisition_rfq_quotation_items row under it. That loss is the
-- whole point of the action once confirmed — the officer is asking for a
-- fresh quote to replace the old one, not to keep both (keeping both would
-- also make pr_rfq_progress's distinct-vendor quote_count wrongly still
-- read this vendor as "quoted" against their new, not-yet-submitted link).
--
-- v_old_submitted_at (and the guard that used it) is removed entirely rather
-- than left unused.
create or replace function public.reissue_rfq_link(
  p_link_id uuid,
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
  v_requisition_id uuid;
  v_pr_status public.pr_status;
  v_new_id uuid;
  v_token text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  select l.requisition_id into v_requisition_id
  from public.purchase_requisition_rfq_links l
  where l.id = p_link_id;

  if v_requisition_id is null then
    raise exception 'RFQ link not found' using errcode = 'P0002';
  end if;

  select pr.status into v_pr_status from public.purchase_requisitions pr where pr.id = v_requisition_id;
  if v_pr_status not in ('pending_rfq', 'rfq_issued', 'quotes_received') then
    raise exception 'RFQ links can no longer be issued for this requisition' using errcode = '55000';
  end if;

  if p_expires_at < now() then
    raise exception 'Expiry cannot be in the past' using errcode = '23514';
  end if;

  -- Hard-deletes the old link regardless of whether it was ever submitted
  -- through — see the migration header comment above for why this is now
  -- an accepted, officer-confirmed data loss rather than a blocked action.
  delete from public.purchase_requisition_rfq_links
  where purchase_requisition_rfq_links.id = p_link_id;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.purchase_requisition_rfq_links
    (requisition_id, vendor_name, vendor_email, access_token, message, expires_at, created_by)
  values
    (v_requisition_id, p_vendor_name, p_vendor_email, v_token, p_message, p_expires_at, v_uid)
  returning purchase_requisition_rfq_links.id into v_new_id;

  return query select v_new_id, v_token;
end;
$$;
