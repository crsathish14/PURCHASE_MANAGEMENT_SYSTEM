-- Store one vendor-submitted proforma invoice on the issued PO and make the
-- token unavailable after submission.
alter table public.purchase_order_issuances
  add column proforma_invoice_path text,
  add column proforma_invoice_file_name text,
  add column proforma_received_at timestamptz,
  add constraint purchase_order_issuances_proforma_submission_check check (
    (proforma_invoice_path is null and proforma_invoice_file_name is null and proforma_received_at is null)
    or (
      proforma_invoice_path is not null
      and proforma_invoice_file_name is not null
      and proforma_received_at is not null
    )
  );

-- The shared private bucket keeps its existing 5 MB limit and now also accepts
-- the one additional content type used by the vendor PO submission flow.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'
]
where id = 'attachments';

-- The staff search RPC is security-invoker and needs only the receipt marker,
-- never the vendor's private invoice path or filename.
grant select (proforma_received_at) on public.purchase_order_issuances to authenticated;

create or replace function public.get_purchase_order_by_token(p_token text)
returns table (
  requisition_id uuid,
  pr_number text,
  vessel_label text,
  category text,
  vendor_name text,
  vendor_email text,
  message text,
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
    pr_list.vessel_label,
    pr_list.category_value,
    i.vendor_name,
    i.vendor_email,
    i.message,
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
  join public.purchase_requisitions pr on pr.id = i.requisition_id
  join public.pr_requisition_list pr_list on pr_list.id = pr.id
  where i.access_token = p_token
    and i.proforma_received_at is null;
$$;

revoke all on function public.get_purchase_order_by_token(text) from public;
grant execute on function public.get_purchase_order_by_token(text) to anon, authenticated;

-- The token remains a single-use capability: only an active issuance can be
-- updated, and concurrent submissions can record only one invoice.
create function public.submit_purchase_order_proforma(
  p_token text,
  p_storage_path text,
  p_file_name text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(p_file_name), '') is null or length(p_file_name) > 255 then
    raise exception 'Proforma invoice file name is invalid' using errcode = '23514';
  end if;

  if p_storage_path is null
    or left(p_storage_path, length('purchase-order-proformas/' || p_token || '/'))
      <> ('purchase-order-proformas/' || p_token || '/')
    or lower(right(p_storage_path, 4)) <> '.pdf'
  then
    raise exception 'Proforma invoice path is invalid' using errcode = '23514';
  end if;

  update public.purchase_order_issuances
  set proforma_invoice_path = p_storage_path,
      proforma_invoice_file_name = p_file_name,
      proforma_received_at = now()
  where access_token = p_token
    and proforma_received_at is null;

  return found;
end;
$$;

revoke all on function public.submit_purchase_order_proforma(text, text, text) from public, anon, authenticated;
grant execute on function public.submit_purchase_order_proforma(text, text, text) to service_role;

-- Staff can no longer retrieve/copy a vendor link after the proforma is
-- received; any already-copied link also fails the public lookup above.
create or replace function public.get_purchase_order_issue_token(p_requisition_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_access_token text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  select i.access_token into v_access_token
  from public.purchase_order_issuances i
  where i.requisition_id = p_requisition_id
    and i.proforma_received_at is null;

  return v_access_token;
end;
$$;

revoke all on function public.get_purchase_order_issue_token(uuid) from public, anon;
grant execute on function public.get_purchase_order_issue_token(uuid) to authenticated;

-- Page-level status advances when the vendor's one-time submission succeeds.
create or replace function public.search_purchase_orders(
  p_search text default null,
  p_statuses text[] default null,
  p_vessels text[] default null,
  p_categories text[] default null,
  p_date_preset text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_page int default 1,
  p_page_size int default 20
)
returns table (
  id uuid,
  pr_number text,
  requisition_number text,
  pr_title text,
  vessel_label text,
  vendor_name text,
  quote_reference text,
  total_quoted_amount numeric,
  quote_submitted_at timestamptz,
  status text,
  total_count bigint
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
      coalesce(quotation.quotation_no, quotation.ref_no) as quote_reference,
      quotation.total_quoted_amount,
      quotation.created_at as quote_submitted_at,
      case
        when issuance.proforma_received_at is not null then 'proforma_received'::text
        when issuance.requisition_id is not null then 'po_issued'::text
        else 'pending_po'::text
      end as status
    from public.purchase_requisitions pr
    join public.pr_requisition_list pr_list on pr_list.id = pr.id
    join public.purchase_requisition_rfq_quotations quotation
      on quotation.rfq_link_id = pr.awarded_rfq_link_id
      and quotation.requisition_id = pr.id
    left join public.purchase_order_issuances issuance on issuance.requisition_id = pr.id
    where pr.status = 'awarded'
      and pr.awarded_rfq_link_id is not null
      and (
        nullif(btrim(p_search), '') is null
        or strpos(lower(coalesce(pr.pr_number, '')), lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(quotation.vendor_name, '')), lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(quotation.quotation_no, quotation.ref_no, '')), lower(btrim(p_search))) > 0
      )
      and (
        coalesce(cardinality(p_statuses), 0) = 0
        or (issuance.requisition_id is null and 'pending_po' = any(p_statuses))
        or (issuance.requisition_id is not null and issuance.proforma_received_at is null and 'po_issued' = any(p_statuses))
        or (issuance.proforma_received_at is not null and 'proforma_received' = any(p_statuses))
      )
      and (coalesce(cardinality(p_vessels), 0) = 0 or pr_list.vessel_value = any(p_vessels))
      and (coalesce(cardinality(p_categories), 0) = 0 or pr_list.category_value = any(p_categories))
      and (
        p_date_preset is null
        or (p_date_preset = 'last_1_month' and quotation.created_at >= now() - interval '1 month')
        or (p_date_preset = 'last_3_months' and quotation.created_at >= now() - interval '3 months')
        or (p_date_preset = 'last_6_months' and quotation.created_at >= now() - interval '6 months')
        or (
          p_date_preset = 'custom'
          and p_start_date is not null
          and p_end_date is not null
          and quotation.created_at >= p_start_date::timestamptz
          and quotation.created_at < (p_end_date + 1)::timestamptz
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
    matched.quote_reference,
    matched.total_quoted_amount,
    matched.quote_submitted_at,
    matched.status,
    count(*) over() as total_count
  from matched
  order by matched.quote_submitted_at desc, matched.id desc
  limit least(greatest(p_page_size, 1), 100)
  offset greatest((p_page - 1) * p_page_size, 0);
$$;

revoke all on function public.search_purchase_orders(text, text[], text[], text[], text, date, date, int, int) from public;
grant execute on function public.search_purchase_orders(text, text[], text[], text[], text, date, date, int, int) to authenticated;
