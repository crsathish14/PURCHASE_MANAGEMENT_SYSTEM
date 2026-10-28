-- Add LO to the vendor PO PDF token lookup so an LO vendor link can download
-- the issued Purchase Order PDF. The rest of the function is unchanged — LO
-- items are already stored with quantity/uom/unit_price by issue_purchase_order
-- (same code path as Stores, since v_is_service is false for LO).
drop function if exists public.get_purchase_order_pdf_by_token(text);

create function public.get_purchase_order_pdf_by_token(p_token text)
returns table (
  requisition_id uuid,
  pr_number text,
  requisition_title text,
  category text,
  vessel_name text,
  vessel_imo_no text,
  vessel_master_owners text,
  issued_vendor_name text,
  issued_vendor_email text,
  vendor_contact_person text,
  quotation_no text,
  ref_no text,
  payment_terms text,
  invoice_to_company_name text,
  invoice_to_address text,
  issued_at timestamptz,
  items jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    i.requisition_id,
    pr.pr_number,
    pr.title,
    pr_list.category_value,
    pr_list.vessel_label,
    vessel.imo_no,
    vessel.master_owners,
    i.vendor_name,
    i.vendor_email,
    quotation.vendor_contact_person,
    quotation.quotation_no,
    quotation.ref_no,
    quotation.payment_terms,
    i.invoice_to_company_name,
    i.invoice_to_address,
    i.issued_at,
    coalesce(item_data.items, '[]'::jsonb)
  from public.purchase_order_issuances i
  join public.purchase_requisitions pr on pr.id = i.requisition_id
  join public.pr_requisition_list pr_list on pr_list.id = pr.id
  join public.purchase_requisition_rfq_quotations quotation on quotation.id = i.quotation_id
  left join public.vessels vessel on vessel.name = pr_list.vessel_label
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'description', issued_item.description,
      'impaCode', coalesce(
        nullif(btrim(quote_item.offered_impa_code), ''),
        nullif(btrim(quote_item.requested_impa_code), '')
      ),
      'partNo', issued_item.part_no,
      'quantity', issued_item.quantity,
      'unit', issued_item.uom,
      'unitPrice', issued_item.unit_price,
      'totalPrice', issued_item.total_price,
      'leadTime', quote_item.delivery_lead_time,
      'remarks', quote_item.remarks
    ) order by issued_item.item_number) as items
    from (
      select
        item.description,
        item.part_no,
        item.uom,
        item.quantity,
        item.unit_price,
        item.total_price,
        row_number() over (order by item.sort_order, item.id) as item_number
      from public.purchase_order_issuance_items item
      where item.issuance_id = i.id
    ) issued_item
    left join (
      select
        qi.offered_impa_code,
        qi.requested_impa_code,
        qi.delivery_lead_time,
        qi.remarks,
        row_number() over (order by qi.sort_order, qi.id) as item_number
      from public.purchase_requisition_rfq_quotation_items qi
      where qi.quotation_id = i.quotation_id
    ) quote_item on quote_item.item_number = issued_item.item_number
  ) item_data on true
  where i.access_token = p_token
    and i.proforma_received_at is null
    and pr_list.category_value in ('stores', 'spares', 'service', 'lo');
$$;

revoke all on function public.get_purchase_order_pdf_by_token(text) from public;
grant execute on function public.get_purchase_order_pdf_by_token(text) to anon, authenticated;
