-- Two new, additive RPCs for the Stores vendor quote form. Neither touches
-- get_rfq_link_by_token/submit_rfq_link/issue_rfq_link (previous migration) —
-- those keep working exactly as they do today; the /quote/[token] page now
-- simply calls get_rfq_quote_details_by_token instead of get_rfq_link_by_token,
-- and the submit route calls submit_rfq_quotation instead of submit_rfq_link.

-- get_rfq_quote_details_by_token: everything get_rfq_link_by_token already
-- returns, plus the PR header fields and line items (with dynamic columns and
-- existing photos) the Stores vendor form needs to render. Deliberately one
-- call returning a superset shape rather than editing the existing function —
-- the "always return the row, let the caller branch on is_expired/submitted_at"
-- philosophy is unchanged.
--
-- Vessel name/IMO No. need a two-hop resolution because purchase_requisitions
-- has no vessel_id FK at all — vessel is a dropdown option value (a slug),
-- and IMO No lives on the separate `vessels` table, joined here by matching
-- the dropdown option's label against vessels.name (the same relationship
-- add_vessel() itself establishes when a vessel is first added).
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
  line_items jsonb
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
    -- Each line item's dynamic columns are flattened straight to {label,
    -- value} pairs (not the separate columns[]/extra{} cross-reference shape
    -- getPurchaseRequisitionById uses) — that indirection exists there only
    -- to correlate a save payload's columns back to its line items; this is
    -- read-only, so the flatter shape is simpler for the vendor form to
    -- consume. Raw storage_path is returned, never a signed URL — Storage's
    -- createSignedUrls is a Storage-API call, not something this function can
    -- do; the TS caller (getRfqQuoteDetailsByToken) batch-signs afterward.
    coalesce(
      (
        select jsonb_agg(
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
            )
          )
          order by li.sort_order
        )
        from public.purchase_requisition_line_items li
        where li.requisition_id = r.id
      ),
      '[]'::jsonb
    )
  from public.purchase_requisition_rfq_links l
  join public.purchase_requisitions r on r.id = l.requisition_id
  where l.access_token = p_token;
end;
$$;

revoke all on function public.get_rfq_quote_details_by_token(text) from public;
grant execute on function public.get_rfq_quote_details_by_token(text) to anon, authenticated;

-- submit_rfq_quotation: the real, richer replacement submission path for the
-- Stores vendor form. Copies submit_rfq_link's own atomic single-use+expiry
-- gate inline (rather than calling that function) so the gate, the quotation
-- insert, every item insert, the recalculated total, and the PR status flip
-- all commit — or roll back — as the one transaction this single function
-- call already is. submit_rfq_link itself is untouched and still exists,
-- simply no longer called by the rebuilt submit route.
--
-- Currency is not a parameter at all — always inserted as 'USD' — so there is
-- no code path through which a vendor could influence it. Approved
-- Qty/IMPA Code/UOM are likewise never accepted from p_items: each is looked
-- up here, live, by exact label match against this requisition's own line
-- item columns (the same "match by exact label, not a stable key" approach
-- line-items-field.tsx already relies on client-side for display, since a
-- column's only persisted identity is its own DB uuid + label — see
-- getPresetColumnsForCategory() in src/lib/purchase-requisition/preset-columns.ts
-- for where 'IMPA/ISSA Code'/'UOM'/'Approved Qty' are assigned at creation
-- time). This is what makes "vendor cannot change Approved Qty" actually true
-- server-side, not just a disabled input client-side.
create function public.submit_rfq_quotation(
  p_token text,
  p_quotation_no text,
  p_ref_no text,
  p_vendor_name text,
  p_vendor_contact_person text,
  p_vendor_contact_no text,
  p_vendor_email text,
  p_vendor_other_details text,
  p_quotation_validity text,
  p_payment_terms text,
  p_delivery_terms text,
  p_remarks_notes text,
  p_items jsonb
)
returns table (success boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link_id uuid;
  v_req_id uuid;
  v_quotation_id uuid;
  v_row jsonb;
  v_line_item_id uuid;
  v_requested_description text;
  v_requested_impa_code text;
  v_approved_qty numeric;
  v_uom text;
  v_unit_price numeric;
  v_total_price numeric;
  v_sort int;
  v_grand_total numeric := 0;
begin
  update public.purchase_requisition_rfq_links
  set submitted_at = now()
  where access_token = p_token
    and submitted_at is null
    and expires_at >= now()
  returning id, requisition_id into v_link_id, v_req_id;

  if v_link_id is null then
    return query select false;
    return;
  end if;

  insert into public.purchase_requisition_rfq_quotations (
    rfq_link_id, requisition_id, quotation_no, ref_no, vendor_name,
    vendor_contact_person, vendor_contact_no, vendor_email, vendor_other_details,
    quotation_validity, payment_terms, delivery_terms, remarks_notes
  )
  values (
    v_link_id, v_req_id, nullif(p_quotation_no, ''), nullif(p_ref_no, ''), p_vendor_name,
    nullif(p_vendor_contact_person, ''), nullif(p_vendor_contact_no, ''), nullif(p_vendor_email, ''),
    nullif(p_vendor_other_details, ''), p_quotation_validity, p_payment_terms, p_delivery_terms,
    p_remarks_notes
  )
  returning id into v_quotation_id;

  v_sort := 0;
  for v_row in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_line_item_id := (v_row ->> 'lineItemId')::uuid;

    -- Confirms this line item genuinely belongs to the requisition this
    -- token is scoped to — a tampered payload can't quote against another
    -- PR's line item by id-guessing.
    if not exists (
      select 1 from public.purchase_requisition_line_items li
      where li.id = v_line_item_id and li.requisition_id = v_req_id
    ) then
      raise exception 'Line item does not belong to this requisition' using errcode = '23514';
    end if;

    select li.description into v_requested_description
    from public.purchase_requisition_line_items li
    where li.id = v_line_item_id;

    select liv.value into v_requested_impa_code
    from public.purchase_requisition_line_item_values liv
    join public.purchase_requisition_line_item_columns c on c.id = liv.column_id
    where liv.line_item_id = v_line_item_id and c.label = 'IMPA/ISSA Code';

    select liv.value into v_uom
    from public.purchase_requisition_line_item_values liv
    join public.purchase_requisition_line_item_columns c on c.id = liv.column_id
    where liv.line_item_id = v_line_item_id and c.label = 'UOM';

    select case when liv.value ~ '^\d+(\.\d+)?$' then liv.value::numeric else null end
      into v_approved_qty
    from public.purchase_requisition_line_item_values liv
    join public.purchase_requisition_line_item_columns c on c.id = liv.column_id
    where liv.line_item_id = v_line_item_id and c.label = 'Approved Qty';

    v_unit_price := nullif(v_row ->> 'unitPrice', '')::numeric;
    v_total_price := case
      when v_approved_qty is not null and v_unit_price is not null then v_approved_qty * v_unit_price
      else null
    end;

    if v_total_price is not null then
      v_grand_total := v_grand_total + v_total_price;
    end if;

    insert into public.purchase_requisition_rfq_quotation_items (
      quotation_id, line_item_id, requested_description, requested_impa_code, approved_qty, uom,
      offered_description, offered_impa_code, unit_price, total_price, delivery_lead_time, remarks,
      sort_order
    )
    values (
      v_quotation_id, v_line_item_id, v_requested_description, v_requested_impa_code, v_approved_qty,
      v_uom, nullif(v_row ->> 'offeredDescription', ''), nullif(v_row ->> 'offeredImpaCode', ''),
      v_unit_price, v_total_price, nullif(v_row ->> 'deliveryLeadTime', ''), nullif(v_row ->> 'remarks', ''),
      v_sort
    );

    v_sort := v_sort + 1;
  end loop;

  update public.purchase_requisition_rfq_quotations
  set total_quoted_amount = v_grand_total
  where id = v_quotation_id;

  update public.purchase_requisitions
  set status = 'quotes_received'
  where purchase_requisitions.id = v_req_id
    and purchase_requisitions.status = 'rfq_issued';

  return query select true;
end;
$$;

revoke all on function public.submit_rfq_quotation(
  text, text, text, text, text, text, text, text, text, text, text, text, jsonb
) from public;
grant execute on function public.submit_rfq_quotation(
  text, text, text, text, text, text, text, text, text, text, text, text, jsonb
) to anon, authenticated;
