-- Records which vendor's RFQ link won, once a requisition is awarded. No
-- `on delete cascade`/`set null` — default `no action` means Postgres itself
-- refuses to delete a link this column still points to, on top of
-- reissue_rfq_link's own pre-existing status guard (it already can't run
-- once a requisition is 'awarded' — see 20260913050000's own comment).
alter table public.purchase_requisitions
  add column awarded_rfq_link_id uuid references public.purchase_requisition_rfq_links (id);
