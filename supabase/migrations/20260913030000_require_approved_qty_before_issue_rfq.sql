-- issue_rfq_link now refuses to issue an RFQ while any line item is missing
-- its Approved Qty — an RFQ sent to a vendor with a blank Approved Qty can't
-- actually be priced against (submit_rfq_quotation's own total_price
-- computation already silently produces null whenever approved_qty is
-- missing), so this catches the gap at the point it's actually actionable
-- rather than only surfacing it once a vendor's quote comes back incomplete.
--
-- Only Stores/Spares PRs have an Approved Qty concept at all — Service has
-- no Qty concept whatsoever (see PR_LINE_ITEM_PRESET_COLUMN,
-- src/lib/constants/purchase-requisition.ts) — so this check is skipped
-- entirely when the requisition's own category dropdown value is 'service'.
--
-- A third distinct errcode for this function (55002, alongside its existing
-- 55000 "wrong requisition status" and 55001 "duplicate vendor email") so
-- the API route can map it to its own specific message.
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
  v_is_service boolean;
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
