-- submit_rfq_quotation now branches on the requisition's own category so
-- Spares and Service quotes are captured correctly instead of silently
-- losing data (Spares' Part No./Item Type had no column to land in at all;
-- Service's total_price always computed to null since it has no Approved
-- Qty/UOM concept for the previous unconditional IMPA/UOM/Approved-Qty
-- lookups to match against).
--
-- Signature is unchanged (still 13 text/jsonb params, returns table (success
-- boolean)) — only the body gains a category branch, same as
-- 20260913020000 already did once before for this same function (adding the
-- photos loop) without needing a drop.
--
-- v_category is resolved once, before the per-item loop, via the same 2-hop
-- dropdown lookup issue_rfq_link already uses for its own v_is_service
-- check — kept as the raw string rather than collapsed to a boolean since
-- three branches are needed here. It never changes mid-loop (one
-- requisition = one category for its whole lifetime). Anything other than
-- 'service'/'spares' — including an unexpected null — deliberately falls
-- through to the original Stores-shaped branch below, so this migration can
-- never change behavior for an existing Stores row even on unexpected data.
create or replace function public.submit_rfq_quotation(
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
  v_category text;
  v_quotation_id uuid;
  v_row jsonb;
  v_line_item_id uuid;
  v_requested_description text;
  v_requested_impa_code text;
  v_requested_part_no text;
  v_approved_qty numeric;
  v_uom text;
  v_unit_price numeric;
  v_total_price numeric;
  v_offered_part_no text;
  v_item_type text;
  v_estimated_duration text;
  v_spares_consumables_included text;
  v_sort int;
  v_grand_total numeric := 0;
  v_photo jsonb;
  v_photo_sort int;
  v_photo_path text;
  v_expected_photo_prefix text;
  v_quotation_item_id uuid;
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

  select dv.option_value into v_category
  from public.purchase_requisition_dropdown_values dv
  join public.pr_dropdown_fields f on f.id = dv.field_id and f.key = 'category'
  where dv.requisition_id = v_req_id;

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

    if not exists (
      select 1 from public.purchase_requisition_line_items li
      where li.id = v_line_item_id and li.requisition_id = v_req_id
    ) then
      raise exception 'Line item does not belong to this requisition' using errcode = '23514';
    end if;

    select li.description into v_requested_description
    from public.purchase_requisition_line_items li
    where li.id = v_line_item_id;

    -- Defensive resets each iteration (not strictly required — v_category is
    -- constant for the whole call — but costs nothing and keeps this
    -- explicit for a future maintainer).
    v_requested_impa_code := null;
    v_requested_part_no := null;
    v_uom := null;
    v_approved_qty := null;
    v_offered_part_no := null;
    v_item_type := null;
    v_estimated_duration := null;
    v_spares_consumables_included := null;

    if v_category = 'service' then
      -- No Qty/UOM/IMPA concept at all for Service. Estimated Duration /
      -- Spares & Consumables Included come straight from the vendor's
      -- payload, same trust level offeredDescription/remarks already get for
      -- Stores. Confirmed product decision: Total Price mirrors Unit
      -- Price/Lump Sum directly — no Qty to multiply by.
      v_estimated_duration := nullif(v_row ->> 'estimatedDuration', '');
      v_spares_consumables_included := nullif(v_row ->> 'sparesConsumablesIncluded', '');
      v_unit_price := nullif(v_row ->> 'unitPrice', '')::numeric;
      v_total_price := v_unit_price;
    else
      -- Stores and Spares share the same UOM + Approved Qty columns/labels.
      select liv.value into v_uom
      from public.purchase_requisition_line_item_values liv
      join public.purchase_requisition_line_item_columns c on c.id = liv.column_id
      where liv.line_item_id = v_line_item_id and c.label = 'UOM';

      select case when liv.value ~ '^\d+(\.\d+)?$' then liv.value::numeric else null end
        into v_approved_qty
      from public.purchase_requisition_line_item_values liv
      join public.purchase_requisition_line_item_columns c on c.id = liv.column_id
      where liv.line_item_id = v_line_item_id and c.label = 'Approved Qty';

      if v_category = 'spares' then
        select liv.value into v_requested_part_no
        from public.purchase_requisition_line_item_values liv
        join public.purchase_requisition_line_item_columns c on c.id = liv.column_id
        where liv.line_item_id = v_line_item_id and c.label = 'Part No./Ref. No.';

        v_offered_part_no := nullif(v_row ->> 'offeredPartNo', '');
        v_item_type := nullif(v_row ->> 'itemType', '');
      else
        -- 'stores', or any unrecognized/null category — original, unchanged
        -- behavior.
        select liv.value into v_requested_impa_code
        from public.purchase_requisition_line_item_values liv
        join public.purchase_requisition_line_item_columns c on c.id = liv.column_id
        where liv.line_item_id = v_line_item_id and c.label = 'IMPA/ISSA Code';
      end if;

      v_unit_price := nullif(v_row ->> 'unitPrice', '')::numeric;
      v_total_price := case
        when v_approved_qty is not null and v_unit_price is not null then v_approved_qty * v_unit_price
        else null
      end;
    end if;

    if v_total_price is not null then
      v_grand_total := v_grand_total + v_total_price;
    end if;

    insert into public.purchase_requisition_rfq_quotation_items (
      quotation_id, line_item_id, requested_description, requested_impa_code, requested_part_no,
      approved_qty, uom, offered_description, offered_impa_code, offered_part_no, item_type,
      unit_price, total_price, delivery_lead_time, remarks, estimated_duration,
      spares_consumables_included, sort_order
    )
    values (
      v_quotation_id, v_line_item_id, v_requested_description, v_requested_impa_code, v_requested_part_no,
      v_approved_qty, v_uom, nullif(v_row ->> 'offeredDescription', ''), nullif(v_row ->> 'offeredImpaCode', ''),
      v_offered_part_no, v_item_type, v_unit_price, v_total_price, nullif(v_row ->> 'deliveryLeadTime', ''),
      nullif(v_row ->> 'remarks', ''), v_estimated_duration, v_spares_consumables_included, v_sort
    )
    returning id into v_quotation_item_id;

    v_expected_photo_prefix := 'rfq-quote-item-photos/' || p_token || '/' || v_line_item_id::text || '/';
    v_photo_sort := 0;
    for v_photo in select * from jsonb_array_elements(coalesce(v_row -> 'photos', '[]'::jsonb)) loop
      v_photo_path := v_photo ->> 'storagePath';

      if v_photo_path is null or left(v_photo_path, length(v_expected_photo_prefix)) <> v_expected_photo_prefix then
        raise exception 'Photo does not belong to this line item' using errcode = '23514';
      end if;

      insert into public.purchase_requisition_rfq_quotation_item_photos (
        quotation_item_id, storage_path, file_name, content_type, size_bytes, sort_order
      )
      values (
        v_quotation_item_id, v_photo_path, v_photo ->> 'fileName', v_photo ->> 'contentType',
        coalesce((v_photo ->> 'sizeBytes')::int, 0), v_photo_sort
      );

      v_photo_sort := v_photo_sort + 1;
    end loop;

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
