-- Spares needs Part No./Item Type captured (never had a home before); Service
-- needs Estimated Duration/Spares & Consumables Included. All nullable, NULL
-- for every existing/future Stores row — no backfill needed.
alter table public.purchase_requisition_rfq_quotation_items
  add column requested_part_no text,
  add column offered_part_no text,
  add column item_type text,
  add column estimated_duration text,
  add column spares_consumables_included text;
