-- Server-side pagination for the vendor RFQ quote form.
--
-- A quote can have 200+ line items, so the form no longer loads them all:
--   * get_rfq_quote_details_by_token returns the header only (plus a count).
--   * get_rfq_quote_line_items_by_token returns ONE page of line items, each
--     with the vendor's saved draft entries merged in, plus the total count and
--     the draft total of every line item *outside* that page (so the grand
--     total stays correct while other pages aren't loaded).
--   * The draft (20261030010000) changes shape to
--       { "header": { field: text }, "items": { "<lineItemId>": { "fields": {..}, "photos": [..] } } }
--     and is now merged per line item on save — a save carries the header plus
--     only the page the vendor is on, and must never erase other pages.
--   * submit assembles the full quote from the stored draft
--     (get_rfq_quote_submission_by_token); submit_rfq_quotation is unchanged.
-- Drafts saved in the old shape (a flat array) simply read as "no items" and
-- are overwritten by the next save.

-- 1. Header-only details ---------------------------------------------------------
-- The return type changes (line_items jsonb -> line_item_count int), which
-- CREATE OR REPLACE can't do — drop then create, and re-issue the grants.
drop function public.get_rfq_quote_details_by_token(text);

create function public.get_rfq_quote_details_by_token(p_token text)
returns table (
  requisition_id uuid,
  pr_number text,
  vendor_name text,
  vendor_email text,
  expires_at timestamptz,
  submitted_at timestamptz,
  is_expired boolean,
  category text,
  requisition_date date,
  requested_by date,
  required_port text,
  vessel_label text,
  vessel_imo_no text,
  equipment_name text,
  equipment_type text,
  equipment_make text,
  equipment_serial_no text,
  equipment_model text,
  equipment_specifications text,
  equipment_other_details text,
  line_item_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    l.requisition_id,
    r.pr_number,
    l.vendor_name,
    l.vendor_email,
    l.expires_at,
    l.submitted_at,
    l.expires_at < now(),
    (
      select opt.value
      from public.purchase_requisition_dropdown_values dv
      join public.pr_dropdown_fields f on f.id = dv.field_id and f.key = 'category'
      join public.pr_dropdown_field_options opt on opt.field_id = dv.field_id and opt.value = dv.option_value
      where dv.requisition_id = r.id
    ),
    r.requisition_date,
    r.requested_by,
    r.required_port,
    (
      select opt.label
      from public.purchase_requisition_dropdown_values dv
      join public.pr_dropdown_fields f on f.id = dv.field_id and f.key = 'vessel'
      join public.pr_dropdown_field_options opt on opt.field_id = dv.field_id and opt.value = dv.option_value
      where dv.requisition_id = r.id
    ),
    (
      select v.imo_no
      from public.purchase_requisition_dropdown_values dv
      join public.pr_dropdown_fields f on f.id = dv.field_id and f.key = 'vessel'
      join public.pr_dropdown_field_options opt on opt.field_id = dv.field_id and opt.value = dv.option_value
      join public.vessels v on v.name = opt.label
      where dv.requisition_id = r.id
    ),
    r.equipment_name,
    r.equipment_type,
    r.equipment_make,
    r.equipment_serial_no,
    r.equipment_model,
    r.equipment_specifications,
    r.equipment_other_details,
    (
      select count(*)::integer
      from public.purchase_requisition_line_items li
      where li.requisition_id = r.id
    )
  from public.purchase_requisition_rfq_links l
  join public.purchase_requisitions r on r.id = l.requisition_id
  where l.access_token = p_token;
end;
$$;

revoke all on function public.get_rfq_quote_details_by_token(text) from public;
grant execute on function public.get_rfq_quote_details_by_token(text) to anon, authenticated;

-- 2. One page of line items -------------------------------------------------------
-- Zero rows for an unknown, expired or already-submitted link. Line items are
-- ordered by (sort_order, id) everywhere in this migration so a page, the
-- "everything outside this page" total, and the submission list always agree
-- on which row is which.
--
-- other_pages_total is the draft total of every line item OUTSIDE the
-- returned page, computed with the same rule submit_rfq_quotation applies:
-- Service = Unit Price directly; every other category = Approved Qty x Unit
-- Price (a missing/non-numeric value contributes nothing).
create function public.get_rfq_quote_line_items_by_token(p_token text, p_offset integer, p_limit integer)
returns table (total_count integer, other_pages_total numeric, line_items jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req_id uuid;
  v_link_id uuid;
  v_category text;
  v_draft_items jsonb;
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 200);
  v_count integer;
  v_other numeric;
  v_page jsonb;
begin
  select l.id, l.requisition_id into v_link_id, v_req_id
  from public.purchase_requisition_rfq_links l
  where l.access_token = p_token
    and l.submitted_at is null
    and l.expires_at >= now();

  if v_link_id is null then
    return;
  end if;

  select dv.option_value into v_category
  from public.purchase_requisition_dropdown_values dv
  join public.pr_dropdown_fields f on f.id = dv.field_id and f.key = 'category'
  where dv.requisition_id = v_req_id;

  select case when jsonb_typeof(d.draft -> 'items') = 'object' then d.draft -> 'items' end
    into v_draft_items
  from public.purchase_requisition_rfq_quote_drafts d
  where d.rfq_link_id = v_link_id;
  v_draft_items := coalesce(v_draft_items, '{}'::jsonb);

  select count(*)::integer into v_count
  from public.purchase_requisition_line_items li
  where li.requisition_id = v_req_id;

  select coalesce(jsonb_agg(p.item order by p.sort_order, p.id), '[]'::jsonb)
    into v_page
  from (
    select
      li.id,
      li.sort_order,
      jsonb_build_object(
        'lineItemId', li.id,
        'description', li.description,
        'columns', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object('label', c.label, 'value', liv.value)
              order by c.sort_order
            )
            from public.purchase_requisition_line_item_values liv
            join public.purchase_requisition_line_item_columns c on c.id = liv.column_id
            where liv.line_item_id = li.id
          ),
          '[]'::jsonb
        ),
        'attachments', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'fileName', a.file_name,
                'contentType', a.content_type,
                'storagePath', a.storage_path
              )
              order by a.sort_order
            )
            from public.purchase_requisition_line_item_attachments a
            where a.line_item_id = li.id
          ),
          '[]'::jsonb
        ),
        'draft', v_draft_items -> (li.id::text)
      ) as item
    from public.purchase_requisition_line_items li
    where li.requisition_id = v_req_id
    order by li.sort_order, li.id
    offset v_offset
    limit v_limit
  ) p;

  select coalesce(sum(
    case
      when v_category = 'service' then pr.price
      else q.qty * pr.price
    end
  ), 0)
    into v_other
  from (
    select li.id, row_number() over (order by li.sort_order, li.id) as rn
    from public.purchase_requisition_line_items li
    where li.requisition_id = v_req_id
  ) i
  left join lateral (
    select case when liv.value ~ '^\d+(\.\d+)?$' then liv.value::numeric end as qty
    from public.purchase_requisition_line_item_values liv
    join public.purchase_requisition_line_item_columns c on c.id = liv.column_id
    where liv.line_item_id = i.id and c.label = 'Approved Qty'
    limit 1
  ) q on true
  cross join lateral (
    select case when s.raw ~ '^\d+(\.\d+)?$' then s.raw::numeric end as price
    from (select v_draft_items -> (i.id::text) -> 'fields' ->> 'unitPrice' as raw) s
  ) pr
  where i.rn <= v_offset or i.rn > v_offset + v_limit;

  return query select v_count, v_other, v_page;
end;
$$;

revoke all on function public.get_rfq_quote_line_items_by_token(text, integer, integer) from public;
grant execute on function public.get_rfq_quote_line_items_by_token(text, integer, integer) to anon, authenticated;

-- 3. Draft header (page load) ------------------------------------------------------
-- The draft's items are delivered with their line item page; the page load
-- only needs the header values and the last-saved time. The return shape
-- changes, so drop first.
drop function public.get_rfq_quote_draft(text);

create function public.get_rfq_quote_draft(p_token text)
returns table (header jsonb, saved_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    case when jsonb_typeof(d.draft -> 'header') = 'object' then d.draft -> 'header' else '{}'::jsonb end,
    d.updated_at
  from public.purchase_requisition_rfq_quote_drafts d
  join public.purchase_requisition_rfq_links l on l.id = d.rfq_link_id
  where l.access_token = p_token
    and l.submitted_at is null
    and l.expires_at >= now();
end;
$$;

revoke all on function public.get_rfq_quote_draft(text) from public;
grant execute on function public.get_rfq_quote_draft(text) to anon, authenticated;

-- 4. Save: header replaced, items merged per line item ----------------------------
-- p_items is an object keyed by line item id. Each entry is merged into the
-- stored entry key-by-key (fields / photos), so a save that only carries a
-- late-finishing photo upload for an item on another page leaves that item's
-- fields alone, and a save for the current page never touches other pages.
-- Ids that aren't this requisition's line items are dropped.
drop function public.save_rfq_quote_draft(text, jsonb);

create function public.save_rfq_quote_draft(p_token text, p_header jsonb, p_items jsonb)
returns table (success boolean, saved_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_id uuid;
  v_req_id uuid;
  v_now timestamptz := now();
  v_old_items jsonb;
  v_new_items jsonb;
  v_merged jsonb;
begin
  select l.id, l.requisition_id into v_link_id, v_req_id
  from public.purchase_requisition_rfq_links l
  where l.access_token = p_token
    and l.submitted_at is null
    and l.expires_at >= v_now;

  if v_link_id is null then
    return query select false, null::timestamptz;
    return;
  end if;

  -- Serializes concurrent saves for the same link (e.g. two open tabs).
  select case when jsonb_typeof(d.draft -> 'items') = 'object' then d.draft -> 'items' end
    into v_old_items
  from public.purchase_requisition_rfq_quote_drafts d
  where d.rfq_link_id = v_link_id
  for update;
  v_old_items := coalesce(v_old_items, '{}'::jsonb);

  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    into v_new_items
  from jsonb_each(coalesce(p_items, '{}'::jsonb)) e
  where e.key in (
    select li.id::text
    from public.purchase_requisition_line_items li
    where li.requisition_id = v_req_id
  );

  select coalesce(jsonb_object_agg(m.k, m.v), '{}'::jsonb)
    into v_merged
  from (
    select
      coalesce(o.key, n.key) as k,
      coalesce(o.value || n.value, n.value, o.value) as v
    from jsonb_each(v_old_items) o
    full join jsonb_each(v_new_items) n on o.key = n.key
  ) m;

  insert into public.purchase_requisition_rfq_quote_drafts (rfq_link_id, draft, updated_at)
  values (
    v_link_id,
    jsonb_build_object('header', coalesce(p_header, '{}'::jsonb), 'items', v_merged),
    v_now
  )
  on conflict (rfq_link_id)
  do update set draft = excluded.draft, updated_at = excluded.updated_at;

  return query select true, v_now;
end;
$$;

revoke all on function public.save_rfq_quote_draft(text, jsonb, jsonb) from public;
grant execute on function public.save_rfq_quote_draft(text, jsonb, jsonb) to anon, authenticated;

-- 5. Everything needed to submit ----------------------------------------------------
-- The saved header plus EVERY line item, in order, with its saved fields and
-- photos (empty for an untouched row). The submit route fills in blanks,
-- validates the whole quote and hands it to submit_rfq_quotation.
create function public.get_rfq_quote_submission_by_token(p_token text)
returns table (header jsonb, items jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_id uuid;
  v_req_id uuid;
  v_draft jsonb;
  v_draft_items jsonb;
begin
  select l.id, l.requisition_id into v_link_id, v_req_id
  from public.purchase_requisition_rfq_links l
  where l.access_token = p_token
    and l.submitted_at is null
    and l.expires_at >= now();

  if v_link_id is null then
    return;
  end if;

  select d.draft into v_draft
  from public.purchase_requisition_rfq_quote_drafts d
  where d.rfq_link_id = v_link_id;

  v_draft_items := case when jsonb_typeof(v_draft -> 'items') = 'object' then v_draft -> 'items' else '{}'::jsonb end;

  return query
  select
    case when jsonb_typeof(v_draft -> 'header') = 'object' then v_draft -> 'header' else '{}'::jsonb end,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'lineItemId', li.id,
            'fields', coalesce(v_draft_items -> (li.id::text) -> 'fields', '{}'::jsonb),
            'photos', coalesce(v_draft_items -> (li.id::text) -> 'photos', '[]'::jsonb)
          )
          order by li.sort_order, li.id
        )
        from public.purchase_requisition_line_items li
        where li.requisition_id = v_req_id
      ),
      '[]'::jsonb
    );
end;
$$;

revoke all on function public.get_rfq_quote_submission_by_token(text) from public;
grant execute on function public.get_rfq_quote_submission_by_token(text) to anon, authenticated;

-- 6. Line item ownership check (photo upload signing) -------------------------------
-- The photo-sign route used to confirm the target line item by loading every
-- line item; now it asks this one cheap question instead.
create function public.is_rfq_quote_line_item(p_token text, p_line_item_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.purchase_requisition_rfq_links l
    join public.purchase_requisition_line_items li on li.requisition_id = l.requisition_id
    where l.access_token = p_token
      and l.submitted_at is null
      and l.expires_at >= now()
      and li.id::text = p_line_item_id
  );
$$;

revoke all on function public.is_rfq_quote_line_item(text, text) from public;
grant execute on function public.is_rfq_quote_line_item(text, text) to anon, authenticated;
