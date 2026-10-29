-- Staff RPC: create an invoice-request link for a PO that has received its
-- proforma but has no existing (or already-submitted) invoice link.
create function public.request_purchase_order_invoice(
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

  -- Must have a proforma before requesting an invoice.
  select * into v_issuance
  from public.purchase_order_issuances
  where requisition_id = p_requisition_id
    and proforma_received_at is not null;

  if not found then
    raise exception 'Proforma has not been received for this purchase order'
      using errcode = '55000';
  end if;

  -- Only one active (non-submitted) invoice link at a time.
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

revoke all on function public.request_purchase_order_invoice(uuid, text, text) from public, anon;
grant execute on function public.request_purchase_order_invoice(uuid, text, text) to authenticated;


-- Vendor RPC: look up PO details by invoice link token (only while unsubmitted).
create function public.get_purchase_order_invoice_by_token(p_token text)
returns table (
  requisition_id uuid,
  pr_number      text,
  vessel_label   text,
  vendor_name    text,
  vendor_email   text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    il.requisition_id,
    pr.pr_number,
    pr_list.vessel_label,
    il.vendor_name,
    il.vendor_email
  from public.purchase_order_invoice_links il
  join public.purchase_requisitions pr      on pr.id      = il.requisition_id
  join public.pr_requisition_list pr_list   on pr_list.id = il.requisition_id
  where il.access_token = p_token
    and il.submitted_at is null;
$$;

revoke all on function public.get_purchase_order_invoice_by_token(text) from public;
grant execute on function public.get_purchase_order_invoice_by_token(text) to anon, authenticated;


-- Vendor RPC: atomically record documents and mark the link as submitted.
-- Called via the admin/service-role client so anon vendors can write.
create function public.submit_purchase_order_invoice(
  p_token          text,
  p_invoice_path   text,
  p_invoice_name   text,
  p_supporting_docs jsonb default '[]'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_id uuid;
  v_doc     jsonb;
  v_idx     int := 0;
begin
  select id into v_link_id
  from public.purchase_order_invoice_links
  where access_token = p_token
    and submitted_at is null
  for update;

  if not found then
    return false;
  end if;

  if nullif(btrim(p_invoice_name), '') is null or length(p_invoice_name) > 500 then
    raise exception 'Invoice filename is invalid' using errcode = '23514';
  end if;

  if p_invoice_path is null
    or left(p_invoice_path, length('po-invoice-documents/' || p_token || '/'))
         <> ('po-invoice-documents/' || p_token || '/')
  then
    raise exception 'Invoice path is invalid' using errcode = '23514';
  end if;

  insert into public.purchase_order_invoice_documents
    (invoice_link_id, document_type, storage_path, original_filename, sort_order)
  values
    (v_link_id, 'invoice', p_invoice_path, p_invoice_name, 0);

  if p_supporting_docs is not null and jsonb_array_length(p_supporting_docs) > 0 then
    if jsonb_array_length(p_supporting_docs) > 5 then
      raise exception 'Maximum 5 supporting documents allowed' using errcode = '23514';
    end if;

    for v_doc in select * from jsonb_array_elements(p_supporting_docs)
    loop
      v_idx := v_idx + 1;
      if (v_doc->>'storage_path') is null
        or left(v_doc->>'storage_path', length('po-invoice-documents/' || p_token || '/'))
             <> ('po-invoice-documents/' || p_token || '/')
      then
        raise exception 'Supporting document path is invalid' using errcode = '23514';
      end if;
      if nullif(btrim(v_doc->>'original_filename'), '') is null then
        raise exception 'Supporting document filename is invalid' using errcode = '23514';
      end if;

      insert into public.purchase_order_invoice_documents
        (invoice_link_id, document_type, storage_path, original_filename, sort_order)
      values
        (v_link_id, 'supporting', v_doc->>'storage_path', v_doc->>'original_filename', v_idx);
    end loop;
  end if;

  update public.purchase_order_invoice_links
  set submitted_at = now()
  where id = v_link_id;

  return true;
end;
$$;

revoke all on function public.submit_purchase_order_invoice(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_purchase_order_invoice(text, text, text, jsonb) to service_role;


-- Staff RPC: retrieve the pending invoice link token for "Copy Link".
-- Returns null when no pending link exists (already submitted or none yet).
create function public.get_purchase_order_invoice_link_token(p_requisition_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid   uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.profiles where id = v_uid and status = 'active'
  ) then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  select access_token into v_token
  from public.purchase_order_invoice_links
  where requisition_id = p_requisition_id
    and submitted_at is null;

  return v_token;
end;
$$;

revoke all on function public.get_purchase_order_invoice_link_token(uuid) from public, anon;
grant execute on function public.get_purchase_order_invoice_link_token(uuid) to authenticated;
