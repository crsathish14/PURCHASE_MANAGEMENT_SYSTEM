-- expires_at needs time-of-day granularity, not just a calendar date — the
-- Issue RFQ modal now collects both a date and a time. Altering the column
-- in place (existing dev-only rows' dates cast to midnight UTC on that
-- date) rather than adding a new column, since nothing outside this
-- table/these three RPCs reads expires_at directly.
alter table public.purchase_requisition_rfq_links
  alter column expires_at type timestamptz using expires_at::timestamptz;

-- The return type is changing (date -> timestamptz), which `create or
-- replace` can't do for a RETURNS TABLE function — must drop first.
-- issue_rfq_link's parameter type is changing too, which would otherwise
-- just create a second, overloaded function instead of replacing this one.
drop function if exists public.get_rfq_link_by_token(text);
drop function if exists public.issue_rfq_link(uuid, text, text, date, text);

-- issue_rfq_link: now also allowed while status is 'quotes_received' — the
-- officer can keep inviting more vendors even after the first quote comes
-- in, right up until the PR is actually awarded (or cancelled).
-- p_expires_at is now timestamptz (was date) to carry the picked time too.
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

revoke all on function public.issue_rfq_link(uuid, text, text, timestamptz, text) from public;
grant execute on function public.issue_rfq_link(uuid, text, text, timestamptz, text) to authenticated;

-- get_rfq_link_by_token: is_expired now compares against now() (an exact
-- instant), not current_date, matching expires_at's new timestamptz
-- precision.
create or replace function public.get_rfq_link_by_token(p_token text)
returns table (
  requisition_id uuid,
  pr_number text,
  vendor_name text,
  expires_at timestamptz,
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
    l.expires_at < now()
  from public.purchase_requisition_rfq_links l
  join public.purchase_requisitions r on r.id = l.requisition_id
  where l.access_token = p_token;
end;
$$;

revoke all on function public.get_rfq_link_by_token(text) from public;
grant execute on function public.get_rfq_link_by_token(text) to anon, authenticated;

-- submit_rfq_link: signature/return type unchanged, only the expiry
-- comparison inside the body — `>= now()` is the exact complement of
-- get_rfq_link_by_token's `< now()` is_expired check above, same
-- relationship the date-based version had with current_date.
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
    and expires_at >= now()
  returning requisition_id into v_req_id;

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
