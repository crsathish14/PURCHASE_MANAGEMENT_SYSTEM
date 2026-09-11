-- Fixes pr_rfq_progress (20260911010000) to count DISTINCT vendors rather
-- than raw purchase_requisition_rfq_links rows. Reissuing an RFQ (see
-- reissue_rfq_link, 20260911040000) creates a second link row for the same
-- vendor — without this fix, vendor_count/quote_count would inflate by one
-- every time a vendor is reissued, even though it's still the same person.
--
-- Column names/types are byte-for-byte unchanged from the original view, so
-- nothing downstream (search_requested_quotes, RequestedQuoteListRow,
-- database.ts) needs to change.
--
-- first_issued_at stays correct under reissue too: expiring a link only
-- changes its expires_at, never its created_at, so min(created_at) across a
-- vendor's old-and-new links is still the PR's true first-ever invite date.
create or replace view public.pr_rfq_progress as
select
  l.requisition_id,
  count(distinct l.vendor_email) as vendor_count,
  min(l.created_at) as first_issued_at,
  count(distinct case when q.id is not null then l.vendor_email end) as quote_count,
  case
    when count(distinct case when q.id is not null then l.vendor_email end) = 0 then 'rfq_issued_status'
    when count(distinct case when q.id is not null then l.vendor_email end) < count(distinct l.vendor_email)
      then 'partial_received'
    else 'all_received'
  end as derived_status
from public.purchase_requisition_rfq_links l
left join public.purchase_requisition_rfq_quotations q on q.rfq_link_id = l.id
group by l.requisition_id;
