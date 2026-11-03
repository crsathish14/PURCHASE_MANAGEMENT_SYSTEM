-- Manual "Paid" step between Proforma Received and Invoice Requested.
-- Payment happens outside the app; staff record it with a button in the
-- Invoice Log. The marker lives on the issuance (one per requisition), like
-- proforma_received_at.
alter table public.purchase_order_issuances
  add column paid_at timestamptz;

-- The security-invoker search RPC needs only the marker.
grant select (paid_at) on public.purchase_order_issuances to authenticated;


-- Staff RPC: record that the proforma has been paid. Idempotent-safe: a second
-- call is refused with 55001 rather than silently moving the timestamp.
create function public.mark_purchase_order_paid(p_requisition_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_paid_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.profiles where id = v_uid and status = 'active'
  ) then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  select i.paid_at into v_paid_at
  from public.purchase_order_issuances i
  where i.requisition_id = p_requisition_id
    and i.proforma_received_at is not null
  for update;

  if not found then
    raise exception 'Proforma has not been received for this purchase order'
      using errcode = '55000';
  end if;

  if v_paid_at is not null then
    raise exception 'This purchase order is already marked as paid'
      using errcode = '55001';
  end if;

  -- An invoice already requested/received means the flow has moved past Paid.
  if exists (
    select 1 from public.purchase_order_invoice_links l
    where l.requisition_id = p_requisition_id
  ) then
    raise exception 'An invoice has already been requested for this purchase order'
      using errcode = '55001';
  end if;

  update public.purchase_order_issuances i
  set paid_at = now()
  where i.requisition_id = p_requisition_id
  returning i.paid_at into v_paid_at;

  return v_paid_at;
end;
$$;

revoke all on function public.mark_purchase_order_paid(uuid) from public, anon;
grant execute on function public.mark_purchase_order_paid(uuid) to authenticated;


-- Requesting an invoice now requires the PO to be marked paid first.
create or replace function public.request_purchase_order_invoice(
  p_requisition_id uuid,
  p_vendor_email   text,
  p_message        text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_issuance   public.purchase_order_issuances%rowtype;
  v_token      text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.profiles where id = v_uid and status = 'active'
  ) then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  select * into v_issuance
  from public.purchase_order_issuances
  where requisition_id = p_requisition_id
    and proforma_received_at is not null;

  if not found then
    raise exception 'Proforma has not been received for this purchase order'
      using errcode = '55000';
  end if;

  if v_issuance.paid_at is null then
    raise exception 'Mark this purchase order as paid before requesting the invoice'
      using errcode = '55000';
  end if;

  if exists (
    select 1 from public.purchase_order_invoice_links
    where requisition_id = p_requisition_id
      and submitted_at is null
  ) then
    raise exception 'An invoice request is already pending for this purchase order'
      using errcode = '55001';
  end if;

  if nullif(btrim(p_vendor_email), '') is null then
    raise exception 'Vendor email is required' using errcode = '23514';
  end if;

  insert into public.purchase_order_invoice_links
    (requisition_id, issuance_id, vendor_name, vendor_email, message)
  select
    p_requisition_id,
    v_issuance.id,
    v_issuance.vendor_name,
    btrim(p_vendor_email),
    p_message
  returning access_token into v_token;

  return v_token;
end;
$$;


-- Same signature and return shape as before, so create or replace is enough.
-- The status ladder gains 'paid' between proforma_received and invoice_requested.
create or replace function public.search_purchase_orders(
  p_search                text    default null,
  p_statuses              text[]  default null,
  p_vessels               text[]  default null,
  p_categories            text[]  default null,
  p_date_preset           text    default null,
  p_start_date            date    default null,
  p_end_date              date    default null,
  p_proforma_date_preset  text    default null,
  p_proforma_start_date   date    default null,
  p_proforma_end_date     date    default null,
  p_page                  int     default 1,
  p_page_size             int     default 20
)
returns table (
  id                  uuid,
  pr_number           text,
  requisition_number  text,
  pr_title            text,
  vessel_label        text,
  vendor_name         text,
  vendor_id           uuid,
  quote_reference     text,
  total_quoted_amount numeric,
  quote_submitted_at  timestamptz,
  status              text,
  total_count         bigint
)
language sql
security invoker
set search_path = public
stable
as $$
  with matched as (
    select
      pr.id,
      pr.pr_number,
      pr_list.requisition_number,
      pr_list.pr_title,
      pr_list.vessel_label,
      pr_list.vessel_value,
      pr_list.category_value,
      quotation.vendor_name,
      rfq_link.vendor_id,
      coalesce(quotation.quotation_no, quotation.ref_no) as quote_reference,
      quotation.total_quoted_amount,
      quotation.created_at as quote_submitted_at,
      case
        when invoice_link.submitted_at     is not null then 'invoice_received'::text
        when invoice_link.id               is not null then 'invoice_requested'::text
        when issuance.paid_at              is not null then 'paid'::text
        when issuance.proforma_received_at is not null then 'proforma_received'::text
        when issuance.requisition_id       is not null then 'po_issued'::text
        else 'pending_po'::text
      end as status,
      issuance.proforma_received_at
    from public.purchase_requisitions pr
    join public.pr_requisition_list pr_list on pr_list.id = pr.id
    join public.purchase_requisition_rfq_quotations quotation
      on quotation.rfq_link_id = pr.awarded_rfq_link_id
      and quotation.requisition_id = pr.id
    left join public.purchase_requisition_rfq_links rfq_link
      on rfq_link.id = pr.awarded_rfq_link_id
    left join public.purchase_order_issuances issuance
      on issuance.requisition_id = pr.id
    left join public.purchase_order_invoice_links invoice_link
      on invoice_link.requisition_id = pr.id
    where pr.status = 'awarded'
      and pr.awarded_rfq_link_id is not null
      and (
        nullif(btrim(p_search), '') is null
        or strpos(lower(coalesce(pr.pr_number, '')),                                   lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(pr_list.requisition_number, '')),                     lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(pr_list.pr_title, '')),                               lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(quotation.vendor_name, '')),                          lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(quotation.quotation_no, quotation.ref_no, '')),       lower(btrim(p_search))) > 0
      )
      and (
        coalesce(cardinality(p_statuses), 0) = 0
        or (issuance.requisition_id is null                                                                and 'pending_po'         = any(p_statuses))
        or (issuance.requisition_id is not null and issuance.proforma_received_at is null
            and invoice_link.id is null                                                                    and 'po_issued'          = any(p_statuses))
        or (issuance.proforma_received_at is not null and issuance.paid_at is null
            and invoice_link.id is null                                                                    and 'proforma_received'  = any(p_statuses))
        or (issuance.paid_at is not null and invoice_link.id is null                                       and 'paid'               = any(p_statuses))
        or (invoice_link.id is not null and invoice_link.submitted_at is null                              and 'invoice_requested'  = any(p_statuses))
        or (invoice_link.submitted_at is not null                                                          and 'invoice_received'   = any(p_statuses))
      )
      and (coalesce(cardinality(p_vessels), 0) = 0    or pr_list.vessel_value   = any(p_vessels))
      and (coalesce(cardinality(p_categories), 0) = 0 or pr_list.category_value = any(p_categories))
      -- quote submission date filter (Purchase Orders page)
      and (
        p_date_preset is null
        or (p_date_preset = 'last_1_month'  and quotation.created_at >= now() - interval '1 month')
        or (p_date_preset = 'last_3_months' and quotation.created_at >= now() - interval '3 months')
        or (p_date_preset = 'last_6_months' and quotation.created_at >= now() - interval '6 months')
        or (
          p_date_preset = 'custom'
          and p_start_date is not null and p_end_date is not null
          and quotation.created_at >= p_start_date::timestamptz
          and quotation.created_at <  (p_end_date + 1)::timestamptz
        )
      )
      -- proforma received date filter (Invoice Log page)
      and (
        p_proforma_date_preset is null
        or (p_proforma_date_preset = 'last_1_month'  and issuance.proforma_received_at >= now() - interval '1 month')
        or (p_proforma_date_preset = 'last_3_months' and issuance.proforma_received_at >= now() - interval '3 months')
        or (p_proforma_date_preset = 'last_6_months' and issuance.proforma_received_at >= now() - interval '6 months')
        or (
          p_proforma_date_preset = 'custom'
          and p_proforma_start_date is not null and p_proforma_end_date is not null
          and issuance.proforma_received_at >= p_proforma_start_date::timestamptz
          and issuance.proforma_received_at <  (p_proforma_end_date + 1)::timestamptz
        )
      )
  )
  select
    matched.id,
    matched.pr_number,
    matched.requisition_number,
    matched.pr_title,
    matched.vessel_label,
    matched.vendor_name,
    matched.vendor_id,
    matched.quote_reference,
    matched.total_quoted_amount,
    matched.quote_submitted_at,
    matched.status,
    count(*) over() as total_count
  from matched
  order by matched.quote_submitted_at desc, matched.id desc
  limit  least(greatest(p_page_size, 1), 100)
  offset greatest((p_page - 1) * p_page_size, 0);
$$;
