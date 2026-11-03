-- Reissue a Purchase Order after the vendor's proforma invoice was received.
-- Deleting the issuance (its items cascade) discards the proforma record and
-- kills the old vendor link, and returns the requisition to 'pending_po' —
-- search_purchase_orders derives that status from the issuance row's absence.
-- The saved draft is left untouched: the prevent-update trigger only blocks
-- edits while an issuance exists, so the draft is editable again.
--
-- Returns the deleted proforma's Storage path so the route handler can remove
-- the object (Storage can't be called from SQL).
create function public.reissue_purchase_order(p_requisition_id uuid)
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

  delete from public.purchase_order_issuances where id = v_issuance_id;

  return v_proforma_path;
end;
$$;

revoke all on function public.reissue_purchase_order(uuid) from public, anon;
grant execute on function public.reissue_purchase_order(uuid) to authenticated;
