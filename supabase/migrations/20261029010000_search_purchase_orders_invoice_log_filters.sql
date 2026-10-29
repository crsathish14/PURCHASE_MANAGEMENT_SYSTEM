-- Extend search_purchase_orders to support Invoice Log filters:
--   1. Search now also matches requisition_number and pr_title (in addition to
--      pr_number, vendor_name, and quote_reference).
--   2. New p_proforma_date_preset / p_proforma_start_date / p_proforma_end_date
--      params let the Invoice Log filter by issuance.proforma_received_at,
--      independently of the existing p_date_preset (which targets quote_submitted_at).
-- The returns table is unchanged, so this is a drop + recreate only because
-- the function signature changes (new params → new overload).
drop function if exists public.search_purchase_orders(text, text[], text[], text[], text, date, date, int, int);

create function public.search_purchase_orders(
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
        or (issuance.proforma_received_at is not null and invoice_link.id is null                          and 'proforma_received'  = any(p_statuses))
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

revoke all    on function public.search_purchase_orders(text, text[], text[], text[], text, date, date, text, date, date, int, int) from public;
grant  execute on function public.search_purchase_orders(text, text[], text[], text[], text, date, date, text, date, date, int, int) to authenticated;
