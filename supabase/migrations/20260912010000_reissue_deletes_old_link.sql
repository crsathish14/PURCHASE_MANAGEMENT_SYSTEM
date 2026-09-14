-- reissue_rfq_link now hard-deletes the vendor's old (never-submitted) link
-- instead of marking it expired. "Expired" should only ever describe a link
-- that genuinely ran out its own clock with no officer intervention — a
-- reissued-away link isn't that, and leaving it behind as an "Expired" row
-- was confusing set alongside a link that actually timed out on its own.
--
-- Safe to hard-delete: the guard above (unchanged) already confirms
-- v_old_submitted_at is null before this point, so there is no
-- purchase_requisition_rfq_quotations row referencing this link id to
-- cascade away — nothing is lost.
--
-- Deleting rather than keeping the row also means issue_rfq_link's
-- duplicate-vendor-email check (20260911060000) still works exactly the
-- same afterward: the new link (inserted below) is the only row left for
-- this vendor_email, so a further plain Issue RFQ to them is still
-- correctly rejected — this migration only changes what happens to the OLD
-- row, not whether a vendor can still only ever have one live invite.
--
-- Known, accepted side effect: pr_rfq_progress's first_issued_at is
-- min(created_at) over whatever rows currently exist — if the link being
-- reissued happened to be the PR's chronologically-first invite, deleting
-- it means that column can advance forward to the next-earliest remaining
-- link's created_at, rather than continuing to reflect the true original
-- issue moment. Deliberately accepted here in favor of never mislabeling a
-- reissued link as "Expired".
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
  v_old_submitted_at timestamptz;
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

  select l.requisition_id, l.submitted_at into v_requisition_id, v_old_submitted_at
  from public.purchase_requisition_rfq_links l
  where l.id = p_link_id;

  if v_requisition_id is null then
    raise exception 'RFQ link not found' using errcode = 'P0002';
  end if;

  -- Can't reissue a link a vendor already responded through — that's not a
  -- stale invite, it already did its job.
  if v_old_submitted_at is not null then
    raise exception 'A quote has already been received for this link' using errcode = '55000';
  end if;

  select pr.status into v_pr_status from public.purchase_requisitions pr where pr.id = v_requisition_id;
  if v_pr_status not in ('pending_rfq', 'rfq_issued', 'quotes_received') then
    raise exception 'RFQ links can no longer be issued for this requisition' using errcode = '55000';
  end if;

  if p_expires_at < now() then
    raise exception 'Expiry cannot be in the past' using errcode = '23514';
  end if;

  delete from public.purchase_requisition_rfq_links
  where purchase_requisition_rfq_links.id = p_link_id;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.purchase_requisition_rfq_links
    (requisition_id, vendor_name, vendor_email, access_token, message, expires_at, created_by)
  values
    (v_requisition_id, p_vendor_name, p_vendor_email, v_token, p_message, p_expires_at, v_uid)
  returning purchase_requisition_rfq_links.id into v_new_id;

  -- No purchase_requisitions.status change needed here (unlike
  -- issue_rfq_link): a PR being reissued to already has >= 1 existing link,
  -- so its pending_rfq -> rfq_issued transition already happened on the
  -- very first issuance.

  return query select v_new_id, v_token;
end;
$$;
