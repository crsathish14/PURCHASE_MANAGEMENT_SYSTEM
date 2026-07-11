Here's how the vendor magic-link portal works end-to-end:

1. Officer issues an RFQ and picks vendors
When a Procurement Officer creates an RFQ from a Purchase Request, they select which vendors to invite (e.g. 3 vendors for the same set of line items). For each selected vendor, the system inserts one row into rfq_vendors with a freshly generated access_token — a long, random, unguessable string (e.g. 48 hex characters via gen_random_bytes(24)), plus an expiry date (token_expires_at, e.g. RFQ deadline + a few days).

2. Officer shares the link
The UI shows the officer a unique URL per vendor, shaped like https://yourapp.com/q/{access_token}. Since there's no automated email in v1, the officer copies this link and sends it however they normally reach that vendor (email, WhatsApp, etc.). Each vendor gets a different token, so the system always knows which vendor is responding — no login required on their end.

3. Vendor opens the link
This hits the public route app/(vendor)/q/[token]/page.tsx — the only unauthenticated page in the whole app. It has no Supabase session at all. Instead of querying tables directly (which would need an open anon policy — risky, since a leaked/guessed token could otherwise expose other data), the page calls a Postgres function get_rfq_by_token(token). That function:

Looks up rfq_vendors by access_token
Checks it hasn't expired and the RFQ is still issued (not closed/cancelled)
If valid, returns just the RFQ's line items (description, qty, unit) — read-only, scoped to that one RFQ
If the token is invalid, expired, or already used past its window, the function returns nothing and the page shows a "this link is no longer valid" message.

4. Vendor fills out and submits the quote
The vendor enters price per line, currency, lead time, payment terms, and optionally attaches a file. On submit, the client calls another Postgres function, submit_vendor_quote(token, ...), not a raw table insert. That function re-validates the token server-side (same checks as above) before inserting into vendor_quotes and flipping rfq_vendors.status to 'quoted'. Because the validation happens inside the database function itself (security definer), there's no way to submit a quote by guessing an RFQ or vendor ID directly — the token is the only key that works, and it's checked every time, not just when the page first loads.

5. Officer compares and awards
Back in the staff app, the RFQ detail page shows all quotes side by side (price, base-currency-converted amount, lead time, terms). The officer picks a winner, which sets rfqs.awarded_quote_id, and can create a PO directly from that quote.

This is why the magic link needs no vendor account/password at all — the token itself is the credential, scoped to exactly one RFQ, one vendor, and one action (view + submit once).