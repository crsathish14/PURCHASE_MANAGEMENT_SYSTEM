# Vessel Purchase Order Management System — Project Blueprint

## Context

The repo's `docs/` folder contains 9 polished static HTML mockups (`dashboard.html`, `design-spec.html`, `pipeline.html`, `po-requests.html`, `request-access.html`, `rfq-issue.html`, `rfq-list.html`, `team-access.html`, `vendor-quote-form.html`) that capture the intended UI/UX and design system. These are the **only** existing artifacts this build considers — they are a UI/UX reference, not code to be reused or migrated. The rest of the system (application, schema, backend) is being designed and built fresh.

Through a requirements interview, the user decided to build the system with React + Next.js + TypeScript on the frontend and Supabase (Postgres + Auth + Storage) as the backend, using the `docs/` mockups purely as the visual/UX reference to build toward. Goal: replace spreadsheet/email-driven procurement with a single, auditable system for one shipping company's shore-based procurement team, built solo/small-team, in a matter of weeks, on a near-zero hosting budget.

This blueprint is the result of that interview plus an architecture design pass, and is meant to be followed from day one through deployment.

## Requirements Summary

- **Business context**: Single shipping company, internal tool (no multi-tenancy). Primary goal: replace spreadsheet/email procurement chaos with one source of truth + audit trail.
- **Users (v1)**: Shore-based Procurement Officers (primary), Admins. Two Supabase Auth roles only: `admin`, `procurement_officer`. New users self-serve **request** access (ref `docs/request-access.html`); an admin reviews each request and approves or denies it before the account can sign in. No self-serve invite flow or granular permission matrix beyond the two roles.
- **Scale**: Small — under 10 vessels, under 50 vendors, under 10 staff users. No special performance engineering needed beyond indexed FKs.
- **V1 scope (in)**: Full procurement lifecycle — Purchase Request → RFQ → Vendor Quotes → Purchase Order → Delivery Note → Invoice. Vendor quote submission via a per-RFQ magic link (no vendor accounts, no transactional email automation — staff copy/share the link manually). PDF generation for formal PO and RFQ documents. Basic dashboard KPIs. File attachments (invoices, delivery notes, quotes) via Supabase Storage.
- **V1 scope (deferred to phase 2)**: Vessel budget tracking/alerts, full Team/Admin role-management UI, spend analytics/reporting, transactional email automation, multi-level approval-by-amount.
- **Approval workflow**: Simple single-approver flow (`admin` approves/issues a PO) — not multi-level.
- **Currency**: Multi-currency support with **live exchange-rate conversion** to a company base currency, plus the ability for staff to **manually override** a fetched rate (e.g. when a specific bank/vendor rate was negotiated).
- **Hosting**: Low/no-cost — Vercel (frontend) + Supabase Cloud (DB/Auth/Storage), both free tier.

## Architecture Decisions

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel.
- **Backend**: Supabase — Postgres with RLS, Supabase Auth for identity, Supabase Storage for attachments.
- **Schema management**: Supabase CLI migrations under `supabase/migrations/*.sql`, checked into git, as the single source of truth for the schema.
- **PDF generation**: `@react-pdf/renderer` (pure JS, no headless Chromium) for PO/RFQ documents, run server-side in Next.js Route Handlers.
- **Forms/validation**: `react-hook-form` + `zod`, shared schemas between client forms and server-side RPC/Route Handler validation.
- **Vendor magic link**: unauthenticated public route, backed by `security definer` Postgres RPCs (`get_rfq_by_token`, `submit_vendor_quote`) rather than direct table RLS grants to `anon` — keeps the one public surface tightly scoped.
- **Currency conversion**: a company-wide `base_currency` (e.g. USD) is used for reporting/comparison. `lib/fx.ts` fetches live daily rates from a free, no-key FX API (e.g. frankfurter.app, ECB-sourced) via a Route Handler, cached in a small `fx_rate_cache` table (refreshed if older than ~12–24h) to avoid hammering the API. Every money-bearing form (vendor quote, PO, invoice) auto-fills the converted `base_amount` from the live rate but lets the user edit the rate directly before saving, recording whether it came from `'live'` or `'manual'`.

## Data Model (Postgres / Supabase)

Conventions: every money field is `amount numeric(14,2)` + `currency text`; every lifecycle table uses a Postgres `enum` for status; every table has `created_at`/`updated_at` and (where applicable) `created_by uuid references profiles(id)`; all FK columns are explicitly indexed. The three tables that carry a primary money amount (`vendor_quotes`, `purchase_orders`, `invoices`) additionally carry `exchange_rate numeric(14,6)` (rate from `currency` to the company `base_currency` at time of entry), `base_amount numeric(14,2)` (`amount * exchange_rate`, generated column), and `rate_source text` (`'live'`/`'manual'`) — see the Currency conversion decision above.

- **`app_settings`** — single-row config table: `base_currency text default 'USD'` (the currency all `base_amount` columns convert to for reporting/comparison across vendors).
- **`fx_rate_cache`** — `currency_pair text primary key` (e.g. `'EUR_USD'`), `rate numeric(14,6)`, `fetched_at timestamptz`. Populated/refreshed by `lib/fx.ts` when a cached rate is missing or older than ~12–24h.

- **`profiles`** — 1:1 with `auth.users`. `id`, `full_name`, `role user_role enum('admin','procurement_officer')`, `status profile_status enum('pending','active','disabled')` default `'pending'`, `requested_role text` (free-form label from the request form, e.g. "Technical Superintendent" — informational only, doesn't grant permissions), `requested_vessel text`, `reviewed_by uuid references profiles(id)`, `reviewed_at timestamptz`. Populated via a `handle_new_user()` trigger on `auth.users` insert, reading `requested_role`/`requested_vessel`/`full_name` out of the signup call's user metadata.
  - **Access request flow**: the public "Request access" page calls `supabase.auth.signUp()` directly (no separate pre-account table, no password stored outside Supabase Auth) — this creates the `auth.users` row immediately with the password the user chose, and the trigger creates a matching `profiles` row with `status='pending'`. The `(staff)` layout guard blocks anyone whose `status != 'active'`, redirecting them to a "pending approval" holding page. An admin reviews pending profiles in `settings/team`, sets the real `role`, and flips `status` to `'active'` (approve) or `'disabled'` (deny) — no custom email sending required for this flow.
- **`vessels`** — `id`, `name`, `imo unique`, `registration_no`, `flag`, `active`.
- **`vendors`** — `id`, `name`, `country`, `contact_person`, `email`, `phone`, `port`, `default_currency`, `payment_terms`, `categories text[]`, `rating`, `active`.
- **`purchase_requests`** (`pr_status enum`: draft/pending_rfq/rfq_issued/po_issued/closed/cancelled) — `ref` (auto-generated e.g. `PR-2026-0042`), `vessel_id`, `requested_by`, `category`, `priority`, `required_by`, `status`.
  - **`pr_line_items`** — `pr_id`, `item_no`, `description`, `part_no`, `qty`, `unit`, `category`.
- **`rfqs`** (`rfq_status enum`: draft/issued/closed/awarded/cancelled) — `ref` (`RFQ-2026-0017`), `pr_id`, `issued_date`, `deadline`, `awarded_quote_id`.
  - **`rfq_line_items`** — copied from `pr_line_items` at issue time (so later PR edits don't retroactively change an issued RFQ).
  - **`rfq_vendors`** (join table) — `rfq_id`, `vendor_id`, `access_token` (unique, random — the magic link), `token_expires_at`, `status` (pending/viewed/quoted/declined).
  - **`vendor_quotes`** — `rfq_vendor_id`, `vendor_id`, `rfq_id`, `amount`, `currency`, `exchange_rate`, `base_amount`, `rate_source`, `lead_time_days`, `delivery_date`, `payment_terms`, `remarks`, `submitted_at`.
  - **`vendor_quote_line_items`** (optional, line-level pricing) — `quote_id`, `rfq_line_item_id`, `unit_price`, `qty`.
- **`purchase_orders`** (`po_status enum`: draft/pending_approval/approved/issued/partially_delivered/delivered/closed/cancelled) — `ref` (`PO-2026-1042`), `pr_id`, `rfq_id` (nullable — direct POs allowed), `vendor_id`, `vessel_id` (denormalized for dashboard filtering), `amount`, `currency`, `exchange_rate`, `base_amount`, `rate_source`, `incoterms`, `expected_delivery_date`, `approved_by`, `approved_at`, `pdf_path`.
  - **`po_line_items`** — `description`, `part_no`, `qty`, `unit`, `unit_price`, `line_total`.
- **`delivery_notes`** (`dn_status enum`: pending/partial/received/discrepancy) — `ref`, `po_id`, `dn_date`, `received_by`, `remarks`.
- **`invoices`** (`invoice_status enum`: received/under_review/approved/paid/disputed) — `ref`, `po_id`, `vendor_id`, `amount`, `currency`, `exchange_rate`, `base_amount`, `rate_source`, `invoice_date`, `due_date`.
- **`attachments`** (generic, no polymorphic FK — enforced via check constraint) — `entity_type` (`invoice`/`delivery_note`/`vendor_quote`/`purchase_order`), `entity_id`, `storage_bucket`, `storage_path`, `file_name`, `content_type`, `uploaded_by` (nullable for vendor uploads). Indexed on `(entity_type, entity_id)`.

**RLS shape**: Since this is a single company with only two roles and no per-vessel segregation requirement, staff tables use a simple "any authenticated + active `profiles` row can read/write" policy, with `admin`-only policies reserved for deletes and for `profiles.role` changes. The vendor-facing magic-link surface is the one exception: it must go through `security definer` RPCs that validate the token server-side, not direct `anon` table grants — a guessed/leaked UUID should never be enough to read or write RFQ/quote data.

## Application Structure (Next.js App Router)

```
app/
  (auth)/login/page.tsx                — Supabase Auth sign-in
  (auth)/request-access/page.tsx       — public self-serve request form (ref docs/request-access.html), calls supabase.auth.signUp()
  (auth)/pending-approval/page.tsx     — holding page for signed-in users whose profiles.status is still 'pending' or 'disabled'
  (staff)/                             — authenticated route group
    layout.tsx                         — server-side session + role + status guard, sidebar (ported from docs/design-spec.html)
    dashboard/page.tsx                 — KPIs (ref docs/dashboard.html)
    purchase-requests/{page,new,[id]}  — ref docs/pipeline.html, docs/po-requests.html
    rfqs/{page,new,[id]}               — ref docs/rfq-list.html, docs/rfq-issue.html
    purchase-orders/{page,[id]}
    delivery-notes/{page,[id]}
    invoices/{page,[id]}
    vendors/{page,[id],new}
    vessels/{page,[id]}
    settings/team/page.tsx             — admin-only (ref docs/team-access.html): pending access requests with Approve/Deny actions, plus the active/disabled user list with role management
  (vendor)/q/[token]/{page,submitted}  — PUBLIC magic-link quote form (ref docs/vendor-quote-form.html)
  api/
    pdf/po/[id]/route.ts
    pdf/rfq/[id]/route.ts
    uploads/sign/route.ts              — signed Storage upload URL, validates staff session OR RFQ token
    fx/rate/route.ts                   — returns a live/cached rate for a currency pair (used by quote/PO/invoice forms)
    health/route.ts                    — DB ping for uptime monitoring
lib/
  supabase/{client,server,admin}.ts    — browser / server-component / service-role clients
  fx.ts                                — fetches live rates from a free FX API, reads/writes fx_rate_cache
  pdf/{po-template,rfq-template}.tsx   — @react-pdf/renderer templates
  types/database.ts                    — generated via `supabase gen types typescript`
  validation/{pr,rfq,po,quote}.schema.ts — Zod schemas shared client+server
middleware.ts                          — Supabase session refresh, redirects unauthenticated staff routes
supabase/migrations/*.sql              — versioned schema, source of truth
```

## Phased Roadmap (≈4–6 weeks solo/part-time)

1. **Phase 0 — Setup** (2–3 days): scaffold Next.js/TS/Tailwind app, install deps, create Supabase dev project, port design tokens from `docs/design-spec.html`, set up `lib/supabase/*`.
2. **Phase 1 — Schema + Auth** (3–5 days): write schema as Supabase CLI migrations, enable RLS + policies, `handle_new_user()` trigger, login page, request-access page + pending-approval holding page, `middleware.ts`, role-and-status-gated `(staff)` layout, and the admin approve/deny UI in `settings/team`. Manually create/approve the first admin, verify the full request → pending → approve → active login path end-to-end.
3. **Phase 2 — Master data + PR module** (4–6 days): Vessels/Vendors CRUD, then Purchase Request create/list/detail + line items + status pipeline view.
4. **Phase 3 — RFQ + vendor magic-link portal + FX conversion** (6–8 days): RFQ creation from PR, vendor selection + token generation, `get_rfq_by_token`/`submit_vendor_quote` RPCs (test carefully — this is the one public attack surface), public quote form, quote comparison + award. Build `lib/fx.ts` + `fx_rate_cache` + `api/fx/rate` here (first place amounts/currency are entered) so the same rate-fetch-with-manual-override UI component is reused in PO/Invoice forms in later phases.
5. **Phase 4 — PO module + approval** (4–5 days): PO from awarded quote or manual, line items, single-approver approve/issue flow, reusing the FX rate component from Phase 3.
6. **Phase 5 — Delivery notes, invoices, attachments** (3–4 days): DN/Invoice CRUD against POs, `attachments` table + Storage bucket + upload UI (staff and vendor-side signed-URL paths).
7. **Phase 6 — PDF, dashboard, polish** (4–6 days): PO/RFQ PDF templates + routes, dashboard KPIs, minimal Team/Admin settings, empty/loading/error states, responsive pass against `docs/design-spec.html`.
8. **Phase 7 — Deploy + hardening** (2–3 days): see Deployment Plan below; smoke-test full PR→RFQ→quote→PO→DN→invoice lifecycle in production; write a short admin runbook.

## Deployment / DevOps Plan

- **Supabase**: one Cloud project (free tier sufficient at this scale); optional second free-tier project for dev/staging safety. Schema applied via `supabase db push` from versioned migrations, never ad-hoc Studio edits. Document the free tier's 7-day backup retention and recommend a monthly manual `pg_dump` export as extra insurance. Storage bucket `attachments`, private, RLS-style policies per Section above.
- **Vercel**: connect GitHub repo, Next.js preset, auto-deploy `main` → production, PRs → preview. Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client-safe), `SUPABASE_SERVICE_ROLE_KEY` (server-only), `NEXT_PUBLIC_SITE_URL`.
- **CI**: single GitHub Actions workflow on `pull_request` — `npm ci` → `lint` → `typecheck` (`tsc --noEmit`) → `build`. No test framework mandated for v1; add a few Vitest unit tests around the RFQ token RPC guard logic and PDF line-total calculations once Phase 6 lands.
- **Monitoring**: Vercel's built-in request logs, Supabase's built-in API/Postgres logs, plus `app/api/health/route.ts` pinged by a free external uptime checker (e.g. UptimeRobot). Document key rotation steps for `SUPABASE_SERVICE_ROLE_KEY` and how to manually expire an `rfq_vendors.access_token` if a link leaks.

## Key Files Referenced

- `docs/design-spec.html` — source of truth for the visual design system (colors, typography, components)
- `docs/dashboard.html`, `docs/po-requests.html`, `docs/pipeline.html`, `docs/rfq-list.html`, `docs/rfq-issue.html`, `docs/vendor-quote-form.html`, `docs/team-access.html` — UI/UX reference per module, listed above against their corresponding routes

## Verification

- After Phase 1: submit a request via `/request-access`, confirm the new account lands on the pending-approval page and cannot reach any `(staff)` route; sign in as the admin, approve the request, and confirm the user can now log in and reach the app. Separately confirm RLS blocks an unauthenticated request to any staff table (e.g. via `curl` with the anon key, no session).
- After Phase 3: open a generated magic link in an incognito window (no session) and confirm a quote can be submitted, but that the RFQ token RPCs reject an invalid/expired token and that no other RFQ's data is reachable via table-level queries. Also submit quotes in at least two non-base currencies and confirm `base_amount` is computed from a live fetched rate, then confirm manually editing the rate before submit correctly stores `rate_source='manual'` and recalculates `base_amount`.
- After Phase 6: run the full lifecycle (create PR → issue RFQ → submit vendor quote via magic link → award → create PO → approve/issue → generate PDF → record delivery note → record invoice with attachment) end-to-end in the dev Supabase project.
- After Phase 7: repeat the full lifecycle once against the production Supabase project post-deploy, and confirm `app/api/health` returns 200 from the deployed Vercel URL.

## Open Items for a Later Conversation (Phase 2, out of scope now)

- Vessel budget tracking & overspend alerts
- Full Team/Admin role-management UI (self-serve invites, granular permissions)
- Spend analytics/reporting (by vessel, by vendor, by category)
- Transactional email automation for RFQ invites and status changes
- Multi-level approval by PO value threshold
