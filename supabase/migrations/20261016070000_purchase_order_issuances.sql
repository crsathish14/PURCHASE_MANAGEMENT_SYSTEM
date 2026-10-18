-- Permanent, token-only vendor links for the awarded Purchase Order. Each
-- issuance stores a snapshot so later quote/draft reads cannot change what
-- the vendor sees at this link.
create table public.purchase_order_issuances (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null unique references public.purchase_requisitions (id) on delete cascade,
  quotation_id uuid not null references public.purchase_requisition_rfq_quotations (id) on delete cascade,
  access_token text not null unique default gen_random_uuid()::text,
  vendor_name text not null,
  vendor_email text not null,
  message text not null,
  issued_at timestamptz not null default now()
);

create table public.purchase_order_issuance_items (
  id uuid primary key default gen_random_uuid(),
  issuance_id uuid not null references public.purchase_order_issuances (id) on delete cascade,
  description text not null,
  part_no text,
  uom text,
  quantity numeric(14, 2),
  unit_price numeric(14, 2),
  total_price numeric(14, 2) not null,
  sort_order integer not null default 0
);

create index purchase_order_issuance_items_issuance_id_idx
  on public.purchase_order_issuance_items (issuance_id, sort_order);

alter table public.purchase_order_issuances enable row level security;
alter table public.purchase_order_issuance_items enable row level security;

create policy "purchase_order_issuances_select_authenticated"
on public.purchase_order_issuances for select
to authenticated
using (true);

revoke all on public.purchase_order_issuances, public.purchase_order_issuance_items from public, anon, authenticated;
-- The authenticated list RPC only needs to know whether a requisition has
-- been issued. Vendor access tokens stay unavailable through table selects.
grant select (requisition_id) on public.purchase_order_issuances to authenticated;

create function public.issue_purchase_order(
  p_requisition_id uuid,
  p_items jsonb,
  p_same_as_quote_qty boolean,
  p_message text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status public.pr_status;
  v_awarded_link_id uuid;
  v_quotation_id uuid;
  v_draft_id uuid;
  v_issuance_id uuid;
  v_access_token text;
  v_vendor_name text;
  v_vendor_email text;
  v_is_service boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  select pr.status, pr.awarded_rfq_link_id
    into v_status, v_awarded_link_id
  from public.purchase_requisitions pr
  where pr.id = p_requisition_id
  for update;

  if not found or v_awarded_link_id is null then
    raise exception 'Awarded requisition not found' using errcode = 'P0002';
  end if;
  if v_status <> 'awarded' then
    raise exception 'A Purchase Order can only be issued for an awarded requisition' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.purchase_order_issuances i where i.requisition_id = p_requisition_id
  ) then
    raise exception 'Purchase Order has already been issued' using errcode = '55000';
  end if;
  if nullif(btrim(p_message), '') is null or length(p_message) > 10000 then
    raise exception 'Purchase Order message is invalid' using errcode = '23514';
  end if;

  select q.id, q.vendor_name, q.vendor_email
    into v_quotation_id, v_vendor_name, v_vendor_email
  from public.purchase_requisition_rfq_quotations q
  where q.requisition_id = p_requisition_id
    and q.rfq_link_id = v_awarded_link_id;
  if v_quotation_id is null then
    raise exception 'Awarded quote not found' using errcode = 'P0002';
  end if;
  if nullif(btrim(v_vendor_name), '') is null or nullif(btrim(v_vendor_email), '') is null then
    raise exception 'Awarded quote vendor details are incomplete' using errcode = '23514';
  end if;

  select exists (
    select 1
    from public.purchase_requisition_dropdown_values dv
    join public.pr_dropdown_fields f on f.id = dv.field_id and f.key = 'category'
    where dv.requisition_id = p_requisition_id and dv.option_value = 'service'
  ) into v_is_service;

  if exists (
    select 1
    from public.purchase_requisition_rfq_quotation_items qi
    where qi.quotation_id = v_quotation_id
      and (qi.unit_price is null or (v_is_service and qi.total_price is null))
  ) then
    raise exception 'Awarded quote prices are incomplete' using errcode = '23514';
  end if;

  -- Reuse the trusted draft RPC so the latest quantities are validated and
  -- saved in the same transaction as link creation and the issued snapshot.
  v_draft_id := public.save_purchase_order_draft(
    p_requisition_id,
    p_items,
    p_same_as_quote_qty
  );

  insert into public.purchase_order_issuances (
    requisition_id, quotation_id, vendor_name, vendor_email, message
  ) values (
    p_requisition_id, v_quotation_id, v_vendor_name, v_vendor_email, btrim(p_message)
  ) returning id, access_token into v_issuance_id, v_access_token;

  insert into public.purchase_order_issuance_items (
    issuance_id, description, part_no, uom, quantity, unit_price, total_price, sort_order
  )
  select
    v_issuance_id,
    coalesce(nullif(btrim(qi.offered_description), ''), qi.requested_description),
    coalesce(nullif(btrim(qi.offered_part_no), ''), qi.requested_part_no),
    qi.uom,
    case when v_is_service then null else draft_item.needed_po_qty end,
    qi.unit_price,
    case
      when v_is_service then qi.total_price
      else round(qi.unit_price * draft_item.needed_po_qty, 2)
    end,
    qi.sort_order
  from public.purchase_requisition_rfq_quotation_items qi
  left join public.purchase_order_draft_items draft_item
    on draft_item.draft_id = v_draft_id
    and draft_item.quotation_item_id = qi.id
  where qi.quotation_id = v_quotation_id
  order by qi.sort_order;

  return v_access_token;
end;
$$;

revoke all on function public.issue_purchase_order(uuid, jsonb, boolean, text) from public, anon;
grant execute on function public.issue_purchase_order(uuid, jsonb, boolean, text) to authenticated;

-- The issued snapshot is authoritative after this point. Keep the linked
-- editable draft from drifting away if a caller invokes the draft RPC directly.
create function public.prevent_issued_purchase_order_draft_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.purchase_order_issuances i
    where i.requisition_id = old.requisition_id
  ) then
    raise exception 'Purchase Order quantities are locked after issue' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger prevent_issued_purchase_order_draft_update
before update on public.purchase_order_drafts
for each row execute function public.prevent_issued_purchase_order_draft_update();

create function public.get_purchase_order_by_token(p_token text)
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
  where i.access_token = p_token;
$$;

revoke all on function public.get_purchase_order_by_token(text) from public;
grant execute on function public.get_purchase_order_by_token(text) to anon, authenticated;

revoke all on function public.prevent_issued_purchase_order_draft_update() from public, anon, authenticated;

-- Page-level PO status follows whether an issued, permanent vendor link exists.
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
      pr_list.vessel_value,
      pr_list.category_value,
      quotation.vendor_name,
      coalesce(quotation.quotation_no, quotation.ref_no) as quote_reference,
      quotation.total_quoted_amount,
      quotation.created_at as quote_submitted_at,
      case when issuance.requisition_id is null then 'pending_po'::text else 'po_issued'::text end as status
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
        or (issuance.requisition_id is not null and 'po_issued' = any(p_statuses))
      )
      and (
        coalesce(cardinality(p_vessels), 0) = 0
        or pr_list.vessel_value = any(p_vessels)
      )
      and (
        coalesce(cardinality(p_categories), 0) = 0
        or pr_list.category_value = any(p_categories)
      )
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
