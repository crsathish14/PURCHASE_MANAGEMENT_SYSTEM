-- Server-side search and paging for the Purchase Orders page. In the current
-- scope each row is an awarded vendor quote, not a formal PO record, so its
-- initial PO lifecycle status is Pending PO until PO creation is implemented.
create function public.search_purchase_orders(
  p_search text default null,
  p_page int default 1,
  p_page_size int default 20
)
returns table (
  id uuid,
  pr_number text,
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
      pr_list.vessel_label,
      quotation.vendor_name,
      coalesce(quotation.quotation_no, quotation.ref_no) as quote_reference,
      quotation.total_quoted_amount,
      quotation.created_at as quote_submitted_at,
      'pending_po'::text as status
    from public.purchase_requisitions pr
    join public.pr_requisition_list pr_list on pr_list.id = pr.id
    join public.purchase_requisition_rfq_quotations quotation
      on quotation.rfq_link_id = pr.awarded_rfq_link_id
      and quotation.requisition_id = pr.id
    where pr.status = 'awarded'
      and pr.awarded_rfq_link_id is not null
      and (
        nullif(btrim(p_search), '') is null
        or strpos(lower(coalesce(pr.pr_number, '')), lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(pr_list.vessel_label, '')), lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(quotation.vendor_name, '')), lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(quotation.quotation_no, quotation.ref_no, '')), lower(btrim(p_search))) > 0
      )
  )
  select
    matched.id,
    matched.pr_number,
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

revoke all on function public.search_purchase_orders(text, int, int) from public;
grant execute on function public.search_purchase_orders(text, int, int) to authenticated;
