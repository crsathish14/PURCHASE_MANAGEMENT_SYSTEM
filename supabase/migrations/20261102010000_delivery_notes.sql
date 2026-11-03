-- Delivery / service notes: staff upload up to 5 PDFs per awarded requisition
-- once its vendor proforma invoice has been received. A requisition with no
-- note is offered by search_delivery_note_candidates (the "Add delivery or
-- service note" picker); one with at least one note is listed by
-- search_delivery_notes (the Delivery Notes page). Deleting a requisition's
-- last note puts it back in the picker. No requisition/PO status changes.
create table public.delivery_notes (
  id                uuid        primary key default gen_random_uuid(),
  requisition_id    uuid        not null references public.purchase_requisitions(id),
  storage_path      text        not null,
  original_filename text        not null,
  uploaded_by       uuid        references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index delivery_notes_requisition_id_idx on public.delivery_notes (requisition_id);

-- Same "any active user, app layer is the real gate" trust model as every
-- sibling table. Writes happen only through the security-definer RPCs below.
alter table public.delivery_notes enable row level security;

create policy "Active staff can read delivery notes"
  on public.delivery_notes
  for select to authenticated using (true);

grant select on public.delivery_notes to authenticated;


-- Staff RPC: attach an uploaded PDF to a requisition. The requisition row is
-- locked so two concurrent uploads can't both pass the 5-note cap.
create function public.add_delivery_note(
  p_requisition_id    uuid,
  p_storage_path      text,
  p_original_filename text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_id   uuid;
  v_prefix text := 'delivery-notes/' || p_requisition_id::text || '/';
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.profiles where id = v_uid and status = 'active'
  ) then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  perform 1
  from public.purchase_requisitions
  where id = p_requisition_id
  for update;

  if not found then
    raise exception 'Requisition not found' using errcode = 'P0002';
  end if;

  -- A note can only be added once the vendor's proforma invoice is in.
  if not exists (
    select 1 from public.purchase_order_issuances
    where requisition_id = p_requisition_id
      and proforma_received_at is not null
  ) then
    raise exception 'Proforma has not been received for this requisition'
      using errcode = '55000';
  end if;

  if (select count(*) from public.delivery_notes where requisition_id = p_requisition_id) >= 5 then
    raise exception 'A requisition can have at most 5 delivery notes' using errcode = '55001';
  end if;

  if p_storage_path is null or left(p_storage_path, length(v_prefix)) <> v_prefix then
    raise exception 'Delivery note path is invalid' using errcode = '23514';
  end if;

  if nullif(btrim(p_original_filename), '') is null or length(p_original_filename) > 500 then
    raise exception 'Delivery note filename is invalid' using errcode = '23514';
  end if;

  insert into public.delivery_notes (requisition_id, storage_path, original_filename, uploaded_by)
  values (p_requisition_id, p_storage_path, btrim(p_original_filename), v_uid)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.add_delivery_note(uuid, text, text) from public, anon;
grant execute on function public.add_delivery_note(uuid, text, text) to authenticated;


-- Staff RPC: remove a note and hand back its storage path so the caller can
-- delete the Storage object too (Storage can't be reached from SQL).
create function public.delete_delivery_note(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_path text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.profiles where id = v_uid and status = 'active'
  ) then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  delete from public.delivery_notes
  where id = p_id
  returning storage_path into v_path;

  if not found then
    raise exception 'Delivery note not found' using errcode = 'P0002';
  end if;

  return v_path;
end;
$$;

revoke all on function public.delete_delivery_note(uuid) from public, anon;
grant execute on function public.delete_delivery_note(uuid) to authenticated;


-- Picker for the "Add delivery or service note" modal: awarded requisitions
-- whose proforma invoice is received (so proforma_received, invoice_requested
-- and invoice_received alike) and that have no delivery note yet.
create function public.search_delivery_note_candidates(
  p_search    text default null,
  p_page      int  default 1,
  p_page_size int  default 10
)
returns table (
  id                 uuid,
  pr_number          text,
  requisition_number text,
  pr_title           text,
  vessel_label       text,
  category_label     text,
  vendor_name        text,
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
    count(*) over() as total_count
  from matched
  order by matched.proforma_received_at desc, matched.id desc
  limit  least(greatest(p_page_size, 1), 100)
  offset greatest((p_page - 1) * p_page_size, 0);
$$;

revoke all    on function public.search_delivery_note_candidates(text, int, int) from public, anon;
grant  execute on function public.search_delivery_note_candidates(text, int, int) to authenticated;


-- Delivery Notes page: requisitions with at least one note, newest upload
-- first, each carrying its notes. The date filter targets the latest upload.
create function public.search_delivery_notes(
  p_search      text   default null,
  p_vessels     text[] default null,
  p_categories  text[] default null,
  p_date_preset text   default null,
  p_start_date  date   default null,
  p_end_date    date   default null,
  p_page        int    default 1,
  p_page_size   int    default 20
)
returns table (
  id                 uuid,
  pr_number          text,
  requisition_number text,
  pr_title           text,
  vessel_label       text,
  category_label     text,
  vendor_name        text,
  note_count         int,
  last_uploaded_at   timestamptz,
  notes              jsonb,
  total_count        bigint
)
language sql
security invoker
set search_path = public
stable
as $$
  with note_agg as (
    select
      dn.requisition_id,
      count(*)::int        as note_count,
      max(dn.created_at)   as last_uploaded_at,
      jsonb_agg(
        jsonb_build_object(
          'id',               dn.id,
          'originalFilename', dn.original_filename,
          'createdAt',        dn.created_at
        )
        order by dn.created_at, dn.id
      ) as notes
    from public.delivery_notes dn
    group by dn.requisition_id
  ),
  matched as (
    select
      pr.id,
      pr.pr_number,
      pr_list.requisition_number,
      pr_list.pr_title,
      pr_list.vessel_label,
      pr_list.category_label,
      quotation.vendor_name,
      note_agg.note_count,
      note_agg.last_uploaded_at,
      note_agg.notes
    from note_agg
    join public.purchase_requisitions pr on pr.id = note_agg.requisition_id
    join public.pr_requisition_list pr_list on pr_list.id = pr.id
    left join public.purchase_requisition_rfq_quotations quotation
      on quotation.rfq_link_id = pr.awarded_rfq_link_id
      and quotation.requisition_id = pr.id
    where (
        nullif(btrim(p_search), '') is null
        or strpos(lower(coalesce(pr.pr_number, '')),                lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(pr_list.requisition_number, '')),  lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(pr_list.pr_title, '')),            lower(btrim(p_search))) > 0
      )
      and (coalesce(cardinality(p_vessels), 0) = 0    or pr_list.vessel_value   = any(p_vessels))
      and (coalesce(cardinality(p_categories), 0) = 0 or pr_list.category_value = any(p_categories))
      and (
        p_date_preset is null
        or (p_date_preset = 'last_1_month'  and note_agg.last_uploaded_at >= now() - interval '1 month')
        or (p_date_preset = 'last_3_months' and note_agg.last_uploaded_at >= now() - interval '3 months')
        or (p_date_preset = 'last_6_months' and note_agg.last_uploaded_at >= now() - interval '6 months')
        or (
          p_date_preset = 'custom'
          and p_start_date is not null and p_end_date is not null
          and note_agg.last_uploaded_at >= p_start_date::timestamptz
          and note_agg.last_uploaded_at <  (p_end_date + 1)::timestamptz
        )
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
    matched.note_count,
    matched.last_uploaded_at,
    matched.notes,
    count(*) over() as total_count
  from matched
  order by matched.last_uploaded_at desc, matched.id desc
  limit  least(greatest(p_page_size, 1), 100)
  offset greatest((p_page - 1) * p_page_size, 0);
$$;

revoke all    on function public.search_delivery_notes(text, text[], text[], text, date, date, int, int) from public, anon;
grant  execute on function public.search_delivery_notes(text, text[], text[], text, date, date, int, int) to authenticated;
