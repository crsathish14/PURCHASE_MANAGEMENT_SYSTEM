-- Re-request the vendor's tax invoice after it was received. Mirrors
-- reissue_purchase_order for the proforma: the invoice link (and its token) is
-- kept and only its submission is undone, so the status derives back to
-- 'invoice_requested' (link exists, submitted_at is null) and the same vendor
-- link accepts a new upload (get_purchase_order_invoice_by_token and
-- submit_purchase_order_invoice both key off `submitted_at is null`).
--
-- Returns the discarded documents' Storage paths so the route handler can
-- remove the objects (Storage can't be called from SQL).
create function public.rerequest_purchase_order_invoice(p_requisition_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_link_id uuid;
  v_paths text[];
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  select l.id
    into v_link_id
  from public.purchase_order_invoice_links l
  where l.requisition_id = p_requisition_id
    and l.submitted_at is not null
  order by l.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'An invoice can only be re-requested after it has been received'
      using errcode = '55000';
  end if;

  with deleted as (
    delete from public.purchase_order_invoice_documents d
    where d.invoice_link_id = v_link_id
    returning d.storage_path
  )
  select coalesce(array_agg(deleted.storage_path), '{}'::text[]) into v_paths from deleted;

  update public.purchase_order_invoice_links
  set submitted_at = null
  where id = v_link_id;

  return v_paths;
end;
$$;

revoke all on function public.rerequest_purchase_order_invoice(uuid) from public, anon;
grant execute on function public.rerequest_purchase_order_invoice(uuid) to authenticated;
