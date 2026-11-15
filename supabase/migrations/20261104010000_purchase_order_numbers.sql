-- Purchase Order numbers: PO-[vessel code]-[dept]-[category]-[year]-[serial].
--
--   vessel code  vessels.vessel_code (2-5 uppercase letters/digits, unique)
--   dept         DK = Deck, EN = Engine, OTH = anything else
--   category     ST = Stores, SP = Spares, SE = Service, LO = Lub Oil
--   year         calendar year (UTC) of the issue date
--   serial       running counter per vessel per year, starting at 001 (at least
--                3 digits; grows to 4+ digits naturally after 999)
--
-- The number is generated once, inside issue_purchase_order, and stored on the
-- issuance so later changes (a renamed vessel code, a changed department) never
-- alter an issued PO. Reissue keeps the issuance, so it keeps its number.

-- 1. Vessel code -----------------------------------------------------------
alter table public.vessels
  add column vessel_code text,
  add constraint vessels_vessel_code_format check (vessel_code is null or vessel_code ~ '^[A-Z0-9]{2,5}$'),
  add constraint vessels_vessel_code_unique unique (vessel_code);

-- Codes given by the client for the vessels already in use. Matched loosely on
-- the name ("MV Ping Shun" etc.); any other existing vessel stays null until an
-- admin fills the code in from the Vessels settings page.
update public.vessels
set vessel_code = case
  when name ilike '%ping shun%' then 'PS'
  when name ilike '%victory ari%' then 'VCI'
  when name ~* '(^|[^a-z])lila([^a-z]|$)' then 'LL'
end
where vessel_code is null
  and (
    name ilike '%ping shun%'
    or name ilike '%victory ari%'
    or name ~* '(^|[^a-z])lila([^a-z]|$)'
  );

-- 2. Counters and the stored number ---------------------------------------
create table public.purchase_order_number_counters (
  vessel_id uuid not null references public.vessels (id),
  year integer not null,
  last_serial integer not null,
  primary key (vessel_id, year)
);

-- Only the security-definer functions below touch this table.
alter table public.purchase_order_number_counters enable row level security;
revoke all on public.purchase_order_number_counters from public, anon, authenticated;

alter table public.purchase_order_issuances
  add column po_number text,
  add constraint purchase_order_issuances_po_number_unique unique (po_number);

-- 3. Number generation -----------------------------------------------------
-- Assigns (or returns the already-assigned) number for one issuance. Returns
-- null when it cannot be built: the vessel has no code yet, or the requisition
-- has no recognised category. The caller decides whether that is an error.
create function public.assign_purchase_order_number(p_issuance_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requisition_id uuid;
  v_issued_at timestamptz;
  v_existing text;
  v_vessel_id uuid;
  v_vessel_code text;
  v_category text;
  v_department text;
  v_cat_code text;
  v_dept_code text;
  v_year integer;
  v_serial integer;
  v_number text;
begin
  select i.requisition_id, i.issued_at, i.po_number
    into v_requisition_id, v_issued_at, v_existing
  from public.purchase_order_issuances i
  where i.id = p_issuance_id
  for update;

  if not found then
    raise exception 'Purchase Order issuance not found' using errcode = 'P0002';
  end if;
  if v_existing is not null then
    return v_existing;
  end if;

  select v.id, v.vessel_code
    into v_vessel_id, v_vessel_code
  from public.pr_requisition_list l
  join public.vessels v on v.name = l.vessel_label
  where l.id = v_requisition_id;

  if v_vessel_id is null or v_vessel_code is null then
    return null;
  end if;

  select
    max(dv.option_value) filter (where f.key = 'category'),
    max(dv.option_value) filter (where f.key = 'department')
    into v_category, v_department
  from public.purchase_requisition_dropdown_values dv
  join public.pr_dropdown_fields f on f.id = dv.field_id
  where dv.requisition_id = v_requisition_id
    and f.key in ('category', 'department');

  v_cat_code := case v_category
    when 'stores' then 'ST'
    when 'spares' then 'SP'
    when 'service' then 'SE'
    when 'lo' then 'LO'
  end;
  if v_cat_code is null then
    return null;
  end if;

  v_dept_code := case v_department
    when 'deck' then 'DK'
    when 'engine' then 'EN'
    else 'OTH'
  end;

  v_year := extract(year from v_issued_at at time zone 'UTC')::integer;

  -- The upsert row-locks the (vessel, year) counter, so concurrent issues for
  -- the same vessel are serialised and can never receive the same serial.
  insert into public.purchase_order_number_counters as c (vessel_id, year, last_serial)
  values (v_vessel_id, v_year, 1)
  on conflict (vessel_id, year) do update set last_serial = c.last_serial + 1
  returning c.last_serial into v_serial;

  v_number := 'PO-' || v_vessel_code || '-' || v_dept_code || '-' || v_cat_code || '-' || v_year || '-'
    || case when v_serial < 1000 then lpad(v_serial::text, 3, '0') else v_serial::text end;

  update public.purchase_order_issuances
  set po_number = v_number
  where id = p_issuance_id;

  return v_number;
end;
$$;

revoke all on function public.assign_purchase_order_number(uuid) from public, anon, authenticated;

-- 4. Issue: generate the number in the same transaction ---------------------
-- Same signature as 20261021010000_purchase_order_invoice_to.sql; the only
-- change is the number assignment at the end. A missing vessel code aborts the
-- whole issue (55003) so no PO is ever issued without a number.
create or replace function public.issue_purchase_order(
  p_requisition_id uuid,
  p_items jsonb,
  p_same_as_quote_qty boolean,
  p_message text,
  p_invoice_to_company_name text,
  p_invoice_to_address text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access_token text;
  v_issuance_id uuid;
begin
  if p_invoice_to_company_name is null
    or nullif(btrim(p_invoice_to_company_name), '') is null
    or length(p_invoice_to_company_name) > 200
    or length(coalesce(p_invoice_to_address, '')) > 2000 then
    raise exception 'Invoice recipient details are invalid' using errcode = '23514';
  end if;

  v_access_token := public.issue_purchase_order_internal(
    p_requisition_id,
    p_items,
    p_same_as_quote_qty,
    p_message
  );

  update public.purchase_order_issuances
  set invoice_to_company_name = btrim(p_invoice_to_company_name),
      invoice_to_address = btrim(coalesce(p_invoice_to_address, ''))
  where requisition_id = p_requisition_id
    and access_token = v_access_token
  returning id into v_issuance_id;

  if v_issuance_id is null then
    raise exception 'Purchase Order issuance was not saved' using errcode = '23514';
  end if;

  if public.assign_purchase_order_number(v_issuance_id) is null then
    raise exception 'Purchase Order number could not be generated: the vessel has no vessel code' using errcode = '55003';
  end if;

  return v_access_token;
end;
$$;

revoke all on function public.issue_purchase_order(uuid, jsonb, boolean, text, text, text)
  from public, anon, authenticated;
grant execute on function public.issue_purchase_order(uuid, jsonb, boolean, text, text, text)
  to authenticated;

-- 5. Number POs that were issued before this change -------------------------
-- In issue order per vessel/year, so serials follow the real chronology.
do $$
declare
  r record;
begin
  for r in
    select i.id from public.purchase_order_issuances i order by i.issued_at, i.id
  loop
    perform public.assign_purchase_order_number(r.id);
  end loop;
end;
$$;

-- When an admin later gives a vessel its first code, number that vessel's
-- still-unnumbered POs (oldest first). New POs cannot be issued for a vessel
-- without a code, so these can never interleave with newly issued numbers.
create function public.number_unnumbered_purchase_orders_for_vessel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select i.id
    from public.purchase_order_issuances i
    join public.pr_requisition_list l on l.id = i.requisition_id
    where l.vessel_label = new.name
      and i.po_number is null
    order by i.issued_at, i.id
  loop
    perform public.assign_purchase_order_number(r.id);
  end loop;
  return new;
end;
$$;

revoke all on function public.number_unnumbered_purchase_orders_for_vessel() from public, anon, authenticated;

create trigger number_unnumbered_purchase_orders_for_vessel
after update of vessel_code on public.vessels
for each row
when (old.vessel_code is null and new.vessel_code is not null)
execute function public.number_unnumbered_purchase_orders_for_vessel();

-- 6. add_vessel takes the code ----------------------------------------------
drop function public.add_vessel(text, text, text, text, text);

create function public.add_vessel(
  p_name text,
  p_imo_no text,
  p_vessel_code text,
  p_master_owners text,
  p_company_name text,
  p_address text
)
returns table (
  id uuid,
  name text,
  imo_no text,
  vessel_code text,
  master_owners text,
  company_name text,
  address text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_created_at timestamptz;
  v_field_id uuid;
  v_base_slug text;
  v_slug text;
  v_suffix int := 1;
begin
  insert into public.vessels (name, imo_no, vessel_code, master_owners, company_name, address)
  values (p_name, p_imo_no, p_vessel_code, p_master_owners, p_company_name, p_address)
  returning vessels.id, vessels.created_at into v_id, v_created_at;

  select pr_dropdown_fields.id into v_field_id
  from public.pr_dropdown_fields
  where key = 'vessel';

  v_base_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := v_base_slug;
  while exists (
    select 1 from public.pr_dropdown_field_options
    where field_id = v_field_id and value = v_slug
  ) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  end loop;

  insert into public.pr_dropdown_field_options (field_id, value, label, sort_order)
  select v_field_id, v_slug, p_name, coalesce(max(sort_order), -1) + 1
  from public.pr_dropdown_field_options
  where field_id = v_field_id;

  return query
  select v_id, p_name, p_imo_no, p_vessel_code, p_master_owners, p_company_name, p_address, v_created_at;
end;
$$;

revoke all on function public.add_vessel(text, text, text, text, text, text) from public;
grant execute on function public.add_vessel(text, text, text, text, text, text) to authenticated;

-- 7. Expose po_number through the three PO read RPCs -------------------------
-- Each is dropped and recreated because RETURNS TABLE gains a column.

-- Vendor PO page (token). Source: 20261018010000_purchase_order_proforma_submission.sql
drop function public.get_purchase_order_by_token(text);

create function public.get_purchase_order_by_token(p_token text)
returns table (
  requisition_id uuid,
  pr_number text,
  po_number text,
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
    i.po_number,
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

-- Vendor PO PDF (token). Source: 20261027020000_lo_purchase_order_pdf.sql
drop function public.get_purchase_order_pdf_by_token(text);

create function public.get_purchase_order_pdf_by_token(p_token text)
returns table (
  requisition_id uuid,
  pr_number text,
  po_number text,
  requisition_title text,
  category text,
  vessel_name text,
  vessel_imo_no text,
  vessel_master_owners text,
  issued_vendor_name text,
  issued_vendor_email text,
  vendor_contact_person text,
  quotation_no text,
  ref_no text,
  payment_terms text,
  invoice_to_company_name text,
  invoice_to_address text,
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
    i.po_number,
    pr.title,
    pr_list.category_value,
    pr_list.vessel_label,
    vessel.imo_no,
    vessel.master_owners,
    i.vendor_name,
    i.vendor_email,
    quotation.vendor_contact_person,
    quotation.quotation_no,
    quotation.ref_no,
    quotation.payment_terms,
    i.invoice_to_company_name,
    i.invoice_to_address,
    i.issued_at,
    coalesce(item_data.items, '[]'::jsonb)
  from public.purchase_order_issuances i
  join public.purchase_requisitions pr on pr.id = i.requisition_id
  join public.pr_requisition_list pr_list on pr_list.id = pr.id
  join public.purchase_requisition_rfq_quotations quotation on quotation.id = i.quotation_id
  left join public.vessels vessel on vessel.name = pr_list.vessel_label
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'description', issued_item.description,
      'impaCode', coalesce(
        nullif(btrim(quote_item.offered_impa_code), ''),
        nullif(btrim(quote_item.requested_impa_code), '')
      ),
      'partNo', issued_item.part_no,
      'quantity', issued_item.quantity,
      'unit', issued_item.uom,
      'unitPrice', issued_item.unit_price,
      'totalPrice', issued_item.total_price,
      'leadTime', quote_item.delivery_lead_time,
      'remarks', quote_item.remarks
    ) order by issued_item.item_number) as items
    from (
      select
        item.description,
        item.part_no,
        item.uom,
        item.quantity,
        item.unit_price,
        item.total_price,
        row_number() over (order by item.sort_order, item.id) as item_number
      from public.purchase_order_issuance_items item
      where item.issuance_id = i.id
    ) issued_item
    left join (
      select
        qi.offered_impa_code,
        qi.requested_impa_code,
        qi.delivery_lead_time,
        qi.remarks,
        row_number() over (order by qi.sort_order, qi.id) as item_number
      from public.purchase_requisition_rfq_quotation_items qi
      where qi.quotation_id = i.quotation_id
    ) quote_item on quote_item.item_number = issued_item.item_number
  ) item_data on true
  where i.access_token = p_token
    and i.proforma_received_at is null
    and pr_list.category_value in ('stores', 'spares', 'service', 'lo');
$$;

revoke all on function public.get_purchase_order_pdf_by_token(text) from public;
grant execute on function public.get_purchase_order_pdf_by_token(text) to anon, authenticated;

-- Staff PO PDF. Source: 20261021010000_purchase_order_invoice_to.sql
drop function public.get_purchase_order_for_export(uuid);

create function public.get_purchase_order_for_export(p_requisition_id uuid)
returns table (
  requisition_id uuid,
  po_number text,
  vendor_name text,
  vendor_email text,
  invoice_to_company_name text,
  invoice_to_address text,
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
    i.po_number,
    i.vendor_name,
    i.vendor_email,
    i.invoice_to_company_name,
    i.invoice_to_address,
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
  where i.requisition_id = p_requisition_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'active'
    );
$$;

revoke all on function public.get_purchase_order_for_export(uuid) from public, anon;
grant execute on function public.get_purchase_order_for_export(uuid) to authenticated;
