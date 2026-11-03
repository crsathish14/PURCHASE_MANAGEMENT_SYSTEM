-- The "Add delivery or service note" picker now shows how urgently each
-- requisition needs its note, can be filtered by that, and can be sorted by it:
--   danger  - the vendor's tax invoice has been received
--   warning - paid (including invoice requested but not received yet)
--   normal  - proforma received, not paid yet
-- The signature and the returned columns both change, so the function is
-- dropped and recreated instead of create-or-replace'd.
drop function if exists public.search_delivery_note_candidates(text, int, int);

create function public.search_delivery_note_candidates(
  p_search     text   default null,
  p_urgencies  text[] default null,
  p_sort       text   default null,
  p_page       int    default 1,
  p_page_size  int    default 10
)
returns table (
  id                 uuid,
  pr_number          text,
  requisition_number text,
  pr_title           text,
  vessel_label       text,
  category_label     text,
  vendor_name        text,
  urgency            text,
  total_count        bigint
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
      pr_list.category_label,
      quotation.vendor_name,
      case
        when exists (
          select 1 from public.purchase_order_invoice_links invoice_link
          where invoice_link.requisition_id = pr.id
            and invoice_link.submitted_at is not null
        ) then 'danger'::text
        when issuance.paid_at is not null then 'warning'::text
        else 'normal'::text
      end as urgency,
      issuance.proforma_received_at
    from public.purchase_requisitions pr
    join public.pr_requisition_list pr_list on pr_list.id = pr.id
    join public.purchase_order_issuances issuance on issuance.requisition_id = pr.id
    left join public.purchase_requisition_rfq_quotations quotation
      on quotation.rfq_link_id = pr.awarded_rfq_link_id
      and quotation.requisition_id = pr.id
    where pr.status = 'awarded'
      and pr.awarded_rfq_link_id is not null
      and issuance.proforma_received_at is not null
      and not exists (
        select 1 from public.delivery_notes dn where dn.requisition_id = pr.id
      )
      and (
        nullif(btrim(p_search), '') is null
        or strpos(lower(coalesce(pr.pr_number, '')),                lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(pr_list.requisition_number, '')),  lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(pr_list.pr_title, '')),            lower(btrim(p_search))) > 0
      )
  )
  select
    matched.id,
    matched.pr_number,
    matched.requisition_number,
    matched.pr_title,
    matched.vessel_label,
    matched.category_label,
    matched.vendor_name,
    matched.urgency,
    -- Counted after the urgency filter below, so paging matches what is shown.
    count(*) over() as total_count
  from matched
  where coalesce(cardinality(p_urgencies), 0) = 0
     or matched.urgency = any(p_urgencies)
  order by
    case
      when p_sort = 'urgency' then
        case matched.urgency when 'danger' then 0 when 'warning' then 1 else 2 end
      else 0
    end,
    matched.proforma_received_at desc,
    matched.id desc
  limit  least(greatest(p_page_size, 1), 100)
  offset greatest((p_page - 1) * p_page_size, 0);
$$;

revoke all    on function public.search_delivery_note_candidates(text, text[], text, int, int) from public, anon;
grant  execute on function public.search_delivery_note_candidates(text, text[], text, int, int) to authenticated;
