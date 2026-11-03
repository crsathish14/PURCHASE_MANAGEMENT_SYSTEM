-- Reissue now discards only the vendor's received proforma invoice instead of
-- the whole issuance. The PO stays issued (status 'po_issued', quantities
-- locked) and its permanent vendor link works again, because every token
-- lookup keys off `proforma_received_at is null` — so the vendor can simply
-- upload a new proforma. Same signature/return as the earlier version, so
-- `create or replace` is enough.
--
-- Returns the discarded proforma's Storage path so the route handler can remove
-- the object (Storage can't be called from SQL).
create or replace function public.reissue_purchase_order(p_requisition_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_issuance_id uuid;
  v_paid_at timestamptz;
  v_proforma_path text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  select i.id, i.paid_at, i.proforma_invoice_path
    into v_issuance_id, v_paid_at, v_proforma_path
  from public.purchase_order_issuances i
  where i.requisition_id = p_requisition_id
    and i.proforma_received_at is not null
  for update;

  if not found then
    raise exception 'A Purchase Order can only be reissued after its proforma invoice is received'
      using errcode = '55000';
  end if;

  -- Past this point the flow has moved on (payment made outside the app, an
  -- invoice requested, or delivery notes uploaded); reissuing would orphan it.
  if v_paid_at is not null
    or exists (
      select 1 from public.purchase_order_invoice_links l where l.requisition_id = p_requisition_id
    )
    or exists (
      select 1 from public.delivery_notes d where d.requisition_id = p_requisition_id
    )
  then
    raise exception 'This Purchase Order can no longer be reissued'
      using errcode = '55001';
  end if;

  -- All three columns clear together to satisfy the proforma submission check.
  update public.purchase_order_issuances
  set proforma_invoice_path = null,
      proforma_invoice_file_name = null,
      proforma_received_at = null
  where id = v_issuance_id;

  return v_proforma_path;
end;
$$;
