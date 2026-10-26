-- Snapshot the editable invoice recipient details when staff issue a PO.
alter table public.purchase_order_issuances
  add column invoice_to_company_name text not null default '',
  add column invoice_to_address text not null default '';

-- Keep the original issue routine as an internal implementation detail. The
-- public authenticated RPC now requires the Invoice To values in the same
-- transaction that creates the permanent vendor link.
alter function public.issue_purchase_order(uuid, jsonb, boolean, text)
  rename to issue_purchase_order_internal;
revoke all on function public.issue_purchase_order_internal(uuid, jsonb, boolean, text)
  from public, anon, authenticated;

create function public.issue_purchase_order(
  p_requisition_id uuid,
  p_items jsonb,
  p_same_as_quote_qty boolean,
  p_message text,
  p_invoice_to_company_name text,
  p_invoice_to_address text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access_token text;
begin
  if p_invoice_to_company_name is null
    or nullif(btrim(p_invoice_to_company_name), '') is null
    or length(p_invoice_to_company_name) > 200
    or length(coalesce(p_invoice_to_address, '')) > 2000 then
    raise exception 'Invoice recipient details are invalid' using errcode = '23514';
  end if;

  v_access_token := public.issue_purchase_order_internal(
    p_requisition_id,
    p_items,
    p_same_as_quote_qty,
    p_message
  );

  update public.purchase_order_issuances
  set invoice_to_company_name = btrim(p_invoice_to_company_name),
      invoice_to_address = btrim(coalesce(p_invoice_to_address, ''))
  where requisition_id = p_requisition_id
    and access_token = v_access_token;

  if not found then
    raise exception 'Purchase Order issuance was not saved' using errcode = '23514';
  end if;

  return v_access_token;
end;
$$;

revoke all on function public.issue_purchase_order(uuid, jsonb, boolean, text, text, text)
  from public, anon, authenticated;
grant execute on function public.issue_purchase_order(uuid, jsonb, boolean, text, text, text)
  to authenticated;

-- Staff PDF exports keep working after the vendor token is consumed by a
-- proforma submission. This read is scoped to an active signed-in user.
create function public.get_purchase_order_for_export(p_requisition_id uuid)
returns table (
  requisition_id uuid,
  vendor_name text,
  vendor_email text,
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
    i.vendor_name,
    i.vendor_email,
    i.invoice_to_company_name,
    i.invoice_to_address,
    i.issued_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', item.description,
        'partNo', item.part_no,
        'uom', item.uom,
        'quantity', item.quantity,
        'unitPrice', item.unit_price,
        'totalPrice', item.total_price
      ) order by item.sort_order, item.id)
      from public.purchase_order_issuance_items item
      where item.issuance_id = i.id
    ), '[]'::jsonb)
  from public.purchase_order_issuances i
  where i.requisition_id = p_requisition_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'active'
    );
$$;

revoke all on function public.get_purchase_order_for_export(uuid) from public, anon;
grant execute on function public.get_purchase_order_for_export(uuid) to authenticated;
