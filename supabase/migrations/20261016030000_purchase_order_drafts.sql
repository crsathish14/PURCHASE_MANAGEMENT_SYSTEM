-- A Purchase Order starts as a saved draft attached to the requisition's
-- awarded quote. Issuing the PO is a separate workflow and is intentionally
-- not part of this migration.
create table public.purchase_order_drafts (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null unique references public.purchase_requisitions (id) on delete cascade,
  quotation_id uuid not null unique references public.purchase_requisition_rfq_quotations (id) on delete cascade,
  same_as_quote_qty boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_purchase_order_drafts_updated_at
before update on public.purchase_order_drafts
for each row execute function public.set_updated_at();

create table public.purchase_order_draft_items (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.purchase_order_drafts (id) on delete cascade,
  quotation_item_id uuid not null references public.purchase_requisition_rfq_quotation_items (id) on delete cascade,
  needed_po_qty numeric not null check (needed_po_qty >= 0),
  unique (draft_id, quotation_item_id)
);

create index purchase_order_draft_items_draft_id_idx
  on public.purchase_order_draft_items (draft_id);

alter table public.purchase_order_drafts enable row level security;
alter table public.purchase_order_draft_items enable row level security;

create policy "purchase_order_drafts_select_authenticated"
on public.purchase_order_drafts for select
to authenticated
using (true);

create policy "purchase_order_draft_items_select_authenticated"
on public.purchase_order_draft_items for select
to authenticated
using (true);

revoke all on public.purchase_order_drafts, public.purchase_order_draft_items from public, anon, authenticated;
grant select on public.purchase_order_drafts, public.purchase_order_draft_items to authenticated;

-- The only write path validates that this is still the awarded quote for the
-- requisition. Same-as-quote quantities are copied from the immutable quote
-- rows in SQL rather than trusted from the browser payload.
create function public.save_purchase_order_draft(
  p_requisition_id uuid,
  p_items jsonb,
  p_same_as_quote_qty boolean
)
returns uuid
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
  v_is_service boolean;
  v_expected_count integer;
  v_items_count integer;
  v_distinct_count integer;
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

  if v_status is null or v_awarded_link_id is null then
    raise exception 'Awarded requisition not found' using errcode = 'P0002';
  end if;
  if v_status <> 'awarded' then
    raise exception 'A PO draft can only be saved for an awarded requisition' using errcode = '55000';
  end if;

  select q.id into v_quotation_id
  from public.purchase_requisition_rfq_quotations q
  where q.requisition_id = p_requisition_id
    and q.rfq_link_id = v_awarded_link_id;
  if v_quotation_id is null then
    raise exception 'Awarded quote not found' using errcode = 'P0002';
  end if;

  select exists (
    select 1
    from public.purchase_requisition_dropdown_values dv
    join public.pr_dropdown_fields f on f.id = dv.field_id and f.key = 'category'
    where dv.requisition_id = p_requisition_id and dv.option_value = 'service'
  ) into v_is_service;

  select count(*) into v_expected_count
  from public.purchase_requisition_rfq_quotation_items qi
  where qi.quotation_id = v_quotation_id;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Draft items must be an array' using errcode = '23514';
  end if;

  if v_is_service then
    if jsonb_array_length(p_items) <> 0 or p_same_as_quote_qty then
      raise exception 'Service quotes do not have PO quantity fields' using errcode = '23514';
    end if;
  elsif p_same_as_quote_qty then
    if exists (
      select 1
      from public.purchase_requisition_rfq_quotation_items qi
      where qi.quotation_id = v_quotation_id
        and (qi.approved_qty is null or qi.approved_qty < 0)
    ) then
      raise exception 'Quote quantities are incomplete' using errcode = '23514';
    end if;
  else
    select count(*), count(distinct x.quotation_item_id)
      into v_items_count, v_distinct_count
    from jsonb_to_recordset(p_items) as x(quotation_item_id uuid, needed_po_qty numeric);

    if v_items_count <> v_expected_count or v_distinct_count <> v_expected_count then
      raise exception 'Every quote item must have one needed PO quantity' using errcode = '23514';
    end if;

    if exists (
      select 1
      from jsonb_to_recordset(p_items) as x(quotation_item_id uuid, needed_po_qty numeric)
      left join public.purchase_requisition_rfq_quotation_items qi
        on qi.id = x.quotation_item_id and qi.quotation_id = v_quotation_id
      where x.quotation_item_id is null
        or x.needed_po_qty is null
        or x.needed_po_qty < 0
        or qi.id is null
    ) then
      raise exception 'Draft quantities must be valid non-negative values for the awarded quote' using errcode = '23514';
    end if;
  end if;

  insert into public.purchase_order_drafts (requisition_id, quotation_id, same_as_quote_qty)
  values (p_requisition_id, v_quotation_id, p_same_as_quote_qty)
  on conflict (requisition_id) do update
    set quotation_id = excluded.quotation_id,
        same_as_quote_qty = excluded.same_as_quote_qty,
        updated_at = now()
  returning id into v_draft_id;

  delete from public.purchase_order_draft_items di where di.draft_id = v_draft_id;

  if not v_is_service then
    if p_same_as_quote_qty then
      insert into public.purchase_order_draft_items (draft_id, quotation_item_id, needed_po_qty)
      select v_draft_id, qi.id, qi.approved_qty
      from public.purchase_requisition_rfq_quotation_items qi
      where qi.quotation_id = v_quotation_id;
    else
      insert into public.purchase_order_draft_items (draft_id, quotation_item_id, needed_po_qty)
      select v_draft_id, x.quotation_item_id, x.needed_po_qty
      from jsonb_to_recordset(p_items) as x(quotation_item_id uuid, needed_po_qty numeric);
    end if;
  end if;

  return v_draft_id;
end;
$$;

revoke all on function public.save_purchase_order_draft(uuid, jsonb, boolean) from public, anon;
grant execute on function public.save_purchase_order_draft(uuid, jsonb, boolean) to authenticated;
