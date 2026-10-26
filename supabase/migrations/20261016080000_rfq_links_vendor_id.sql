-- Keep RFQ recipients linked to the vendor master record. Historical links
-- are backfilled only when their saved name and email identify one vendor.
alter table public.purchase_requisition_rfq_links
  add column vendor_id uuid references public.vendors (id) on delete restrict;

create index purchase_requisition_rfq_links_vendor_id_idx
  on public.purchase_requisition_rfq_links (vendor_id);

update public.purchase_requisition_rfq_links l
set vendor_id = v.id
from public.vendors v
where v.name = l.vendor_name
  and l.vendor_email = any(v.mail)
  and (
    select count(*)
    from public.vendors candidate
    where candidate.name = l.vendor_name
      and l.vendor_email = any(candidate.mail)
  ) = 1;

-- Vendor identity is the vendor id for new links. Older unlinked rows retain
-- their email-based identity until they are mapped through the reissue flow.
create or replace view public.pr_rfq_progress as
select
  l.requisition_id,
  count(distinct coalesce(l.vendor_id::text, 'email:' || l.vendor_email)) as vendor_count,
  min(l.created_at) as first_issued_at,
  count(distinct case
    when q.id is not null then coalesce(l.vendor_id::text, 'email:' || l.vendor_email)
  end) as quote_count,
  case
    when count(distinct case
      when q.id is not null then coalesce(l.vendor_id::text, 'email:' || l.vendor_email)
    end) = 0 then 'rfq_issued_status'
    when count(distinct case
      when q.id is not null then coalesce(l.vendor_id::text, 'email:' || l.vendor_email)
    end) < count(distinct coalesce(l.vendor_id::text, 'email:' || l.vendor_email))
      then 'partial_received'
    else 'all_received'
  end as derived_status
from public.purchase_requisition_rfq_links l
left join public.purchase_requisition_rfq_quotations q on q.rfq_link_id = l.id
group by l.requisition_id;

-- Replace the free-text RPC arguments with a vendor id and a selected email
-- address. The name and email are read from/validated against the vendor row.
drop function public.issue_rfq_link(uuid, text, text, timestamptz, text);

create function public.issue_rfq_link(
  p_requisition_id uuid,
  p_vendor_id uuid,
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
  v_is_service boolean;
  v_vendor_name text;
  v_vendor_mail text[];
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  select v.name, v.mail into v_vendor_name, v_vendor_mail
  from public.vendors v
  where v.id = p_vendor_id;

  if not found or p_vendor_email is null or not coalesce(p_vendor_email = any(v_vendor_mail), false) then
    raise exception 'Select an email saved for the selected vendor' using errcode = '55003';
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
      and (l.vendor_id = p_vendor_id or l.vendor_email = p_vendor_email)
  ) then
    raise exception 'An RFQ has already been issued to this vendor for this requisition' using errcode = '55001';
  end if;

  select exists (
    select 1
    from public.purchase_requisition_dropdown_values dv
    join public.pr_dropdown_fields f on f.id = dv.field_id and f.key = 'category'
    where dv.requisition_id = p_requisition_id and dv.option_value = 'service'
  ) into v_is_service;

  if not v_is_service and exists (
    select 1
    from public.purchase_requisition_line_items li
    where li.requisition_id = p_requisition_id
      and not exists (
        select 1
        from public.purchase_requisition_line_item_values liv
        join public.purchase_requisition_line_item_columns c on c.id = liv.column_id
        where liv.line_item_id = li.id
          and c.label = 'Approved Qty'
          and liv.value is not null
          and trim(liv.value) <> ''
      )
  ) then
    raise exception 'Approved Qty must be filled for every line item before an RFQ can be issued' using errcode = '55002';
  end if;

  if p_expires_at < now() then
    raise exception 'Expiry cannot be in the past' using errcode = '23514';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.purchase_requisition_rfq_links
    (requisition_id, vendor_id, vendor_name, vendor_email, access_token, message, expires_at, created_by)
  values
    (p_requisition_id, p_vendor_id, v_vendor_name, p_vendor_email, v_token, p_message, p_expires_at, v_uid)
  returning purchase_requisition_rfq_links.id into v_id;

  update public.purchase_requisitions
  set status = 'rfq_issued'
  where purchase_requisitions.id = p_requisition_id
    and purchase_requisitions.status = 'pending_rfq';

  return query select v_id, v_token;
end;
$$;

revoke all on function public.issue_rfq_link(uuid, uuid, text, timestamptz, text) from public;
grant execute on function public.issue_rfq_link(uuid, uuid, text, timestamptz, text) to authenticated;

drop function public.reissue_rfq_link(uuid, text, text, timestamptz, text);

create function public.reissue_rfq_link(
  p_link_id uuid,
  p_vendor_id uuid,
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
  v_old_vendor_id uuid;
  v_pr_status public.pr_status;
  v_new_id uuid;
  v_token text;
  v_vendor_name text;
  v_vendor_mail text[];
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  select l.requisition_id, l.vendor_id into v_requisition_id, v_old_vendor_id
  from public.purchase_requisition_rfq_links l
  where l.id = p_link_id;

  if v_requisition_id is null then
    raise exception 'RFQ link not found' using errcode = 'P0002';
  end if;

  if v_old_vendor_id is not null and v_old_vendor_id <> p_vendor_id then
    raise exception 'This RFQ link is tied to a different vendor' using errcode = '55004';
  end if;

  select v.name, v.mail into v_vendor_name, v_vendor_mail
  from public.vendors v
  where v.id = p_vendor_id;

  if not found or p_vendor_email is null or not coalesce(p_vendor_email = any(v_vendor_mail), false) then
    raise exception 'Select an email saved for the selected vendor' using errcode = '55003';
  end if;

  select pr.status into v_pr_status from public.purchase_requisitions pr where pr.id = v_requisition_id;
  if v_pr_status not in ('pending_rfq', 'rfq_issued', 'quotes_received') then
    raise exception 'RFQ links can no longer be issued for this requisition' using errcode = '55000';
  end if;

  if p_expires_at < now() then
    raise exception 'Expiry cannot be in the past' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.purchase_requisition_rfq_links l
    where l.requisition_id = v_requisition_id
      and l.id <> p_link_id
      and (l.vendor_id = p_vendor_id or l.vendor_email = p_vendor_email)
  ) then
    raise exception 'An RFQ has already been issued to this vendor for this requisition' using errcode = '55001';
  end if;

  -- Reissue intentionally replaces the old link (and any quote beneath it)
  -- after the officer confirms the existing warning in the client.
  delete from public.purchase_requisition_rfq_links l
  where l.id = p_link_id;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.purchase_requisition_rfq_links
    (requisition_id, vendor_id, vendor_name, vendor_email, access_token, message, expires_at, created_by)
  values
    (v_requisition_id, p_vendor_id, v_vendor_name, p_vendor_email, v_token, p_message, p_expires_at, v_uid)
  returning purchase_requisition_rfq_links.id into v_new_id;

  return query select v_new_id, v_token;
end;
$$;

revoke all on function public.reissue_rfq_link(uuid, uuid, text, timestamptz, text) from public;
grant execute on function public.reissue_rfq_link(uuid, uuid, text, timestamptz, text) to authenticated;
