-- reissue_rfq_link: lets an officer recover a stale/ignored RFQ invite by
-- atomically expiring the vendor's current link and issuing them a fresh one
-- (same vendor, new token/expiry/message), in one transaction — mirrors
-- issue_rfq_link's own guard style (20260825010000_rfq_link_expiry_datetime.sql)
-- and, like submit_rfq_quotation, inlines its own gate rather than calling a
-- sibling RPC so the expire-old + insert-new step can never partially apply.
create function public.reissue_rfq_link(
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

  -- Only ever moves expiry earlier — a link that already expired naturally
  -- stays exactly as expired as it was.
  update public.purchase_requisition_rfq_links
  set expires_at = now()
  where id = p_link_id and expires_at > now();

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

revoke all on function public.reissue_rfq_link(uuid, text, text, timestamptz, text) from public;
grant execute on function public.reissue_rfq_link(uuid, text, text, timestamptz, text) to authenticated;
