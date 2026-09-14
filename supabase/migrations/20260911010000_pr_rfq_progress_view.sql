-- Per-requisition RFQ/quote progress, for the Requested Quote list page.
-- Grouped FROM purchase_requisition_rfq_links itself (not a left join off
-- purchase_requisitions) so a PR with zero issued links structurally never
-- produces a row here — "this PR has had an RFQ issued to at least one
-- vendor" doesn't need a separate downstream filter, it's baked into the
-- view's shape.
--
-- quote_count can never exceed vendor_count by construction, not just by
-- trust: purchase_requisition_rfq_quotations.rfq_link_id is unique
-- (20260830010000), so the left join below can never fan a single link row
-- out into more than one joined row — vendor_count (count(*) over the
-- group) and quote_count (count of non-null q.id in the same group) are
-- computed from that same one-row-per-link set.
--
-- derived_status mirrors the Requested Quote page's own 3-state rule (see
-- src/lib/constants/requested-quote.ts, the single TS source of truth for
-- these three literal strings) — computed once, here, rather than
-- re-derived in search_requested_quotes or on the client, so there is
-- exactly one place this logic can drift. Values are deliberately distinct
-- from every public.pr_status label (e.g. 'rfq_issued_status' here vs.
-- pr_status's own 'rfq_issued') since this is a different, page-local
-- concept that happens to share a name.
--
-- Like pr_requisition_list (20260823140000), this view carries no RLS/GRANT
-- of its own — views aren't directly RLS-able, and access is governed
-- entirely by the invoking role's SELECT privileges against the two tables
-- above, both already `select to authenticated using (true)`.
create view public.pr_rfq_progress as
select
  l.requisition_id,
  count(*) as vendor_count,
  min(l.created_at) as first_issued_at,
  count(q.id) as quote_count,
  case
    when count(q.id) = 0 then 'rfq_issued_status'
    when count(q.id) < count(*) then 'partial_received'
    else 'all_received'
  end as derived_status
from public.purchase_requisition_rfq_links l
left join public.purchase_requisition_rfq_quotations q on q.rfq_link_id = l.id
group by l.requisition_id;
