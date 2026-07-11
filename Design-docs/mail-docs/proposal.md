**Prepared for:** Edsteer Shipping
**Date:** 3 July 2026
**Project:** Vessel Purchase Order Management System (Vessel PMS)

---

## 1. Executive Summary

Edsteer Shipping currently manages vessel procurement — purchase requests, vendor quotes, purchase orders, deliveries, and invoices — through a mix of spreadsheets and email. This creates version-control problems, no single audit trail, slow vendor comparisons, and no real-time visibility into what's been ordered, approved, or delivered across the fleet.

We propose to design and build **Vessel PMS**, a purpose-built web application that runs the entire procurement lifecycle — from Purchase Request through RFQ, vendor quoting, Purchase Order, delivery, and invoicing — in one auditable system, accessible from any shore-office computer, live from day one on modern, low-cost cloud infrastructure.

This document covers the proposed solution, technology, timeline, and full cost breakdown — including exactly what is free to run today and what becomes a paid service as the system scales.

---

## 2. Understanding Your Needs

- Procurement currently runs through email threads and spreadsheets, with no single source of truth.
- There is no structured way to compare multiple vendor quotes against the same request.
- Purchase Orders, deliveries, and invoices are tracked manually, making it hard to answer "what's outstanding right now?" without checking multiple files.
- New staff need a controlled, admin-approved way to gain access to the system — not shared logins or ad-hoc spreadsheet access.
- Vendors and vessels transact in multiple currencies, and spend needs to be comparable on a common basis.

---

## 3. Proposed Solution

Vessel PMS is a secure, cloud-hosted web application built around six connected modules:

| Module | What it does |
|---|---|
| **Dashboard** | At-a-glance view of open requests, pending RFQs, POs awaiting delivery, and recent activity. |
| **Purchase Requests (PR)** | Shore staff raise a request per vessel, itemized line by line, tracked through a status pipeline. |
| **RFQ + Vendor Quoting** | Issue an RFQ from a PR, invite vendors via a secure, one-time link (no vendor login required), compare quotes side by side, and award the winner. |
| **Purchase Orders** | Generate a PO from an awarded quote (or manually), route it through a single-approver sign-off, and issue a formal PDF PO document. |
| **Delivery Notes & Invoices** | Record what was received against each PO, and log/track vendor invoices with supporting document attachments (scans, photos). |
| **Access Control** | New users request access through a self-serve form; an administrator reviews and approves or denies each request before the account can be used. |

**A note on vendor quoting:** vendors never need an account or password. Each RFQ generates a unique, secure link per vendor — they open it, submit their quote, and that's it. This keeps onboarding friction at zero for your vendor network while keeping the data fully access-controlled on your side.

**A note on currency:** every quote, PO, and invoice can be entered in its native currency (USD, EUR, SGD, etc.). The system automatically converts it to your chosen base currency using live daily exchange rates, so spend is always comparable — but staff can manually override the rate on any transaction when a specific negotiated rate applies.

---

## 4. Technology (Plain-Language Overview)

We're proposing a modern, widely-used, and low-maintenance technology stack — chosen specifically because it minimizes ongoing hosting costs and avoids vendor lock-in to any single expensive platform:

- **Application**: Built with **Next.js** (React) — one of the most widely adopted frameworks for business web applications, used by companies of all sizes. This means the codebase is easy to hand off, extend, or have maintained by any competent development team in the future — you are not locked into us.
- **Database & Backend**: Built on **Supabase**, a hosted platform built on standard PostgreSQL (the same open-source database technology used by banks, governments, and large enterprises). It includes secure login, role-based access, and file storage out of the box, which keeps development time — and cost — down.
- **Hosting**: Deployed on **Vercel**, a production-grade hosting platform with automatic deployment, global performance, and built-in security (HTTPS by default).
- **Documents**: Formal PDF Purchase Orders and RFQs are generated directly by the system — no manual formatting.

All of this runs on infrastructure with a genuine free tier for the development phase, and predictable, low monthly costs once live (see Section 6).

---

4 phase.

## 5. Project Timeline

Estimated **5–7 weeks** from kickoff to production launch, delivered in demoable phases rather than one large release at the end — you'll be able to see and test working software from week one.

| Phase | Deliverable | Estimated Duration |
|---|---|---|
| 0 — Setup | Project scaffolding, hosting/database accounts created, visual design system applied | 2–3 days |
| 1 — Access & Security | Login, self-serve access requests with admin approval, secure roles | 3–5 days |
| 2 — Core Data & Purchase Requests | Vessels, vendors, and the full Purchase Request workflow | 4–6 days |
| 3 — RFQ & Vendor Quoting | RFQ issuing, secure vendor quote links, quote comparison, live currency conversion | 6–8 days |
| 4 — Purchase Orders | PO creation, approval workflow, issuing | 4–5 days |
| 5 — Delivery & Invoicing | Delivery tracking, invoice logging, file attachments | 3–4 days |
| 6 — Dashboard, PDFs & Polish | Dashboard KPIs, formal PDF documents, final UI polish | 4–6 days |
| 7 — Launch | Production deployment, end-to-end testing, handover documentation | 2–3 days |

---

## 6. Investment

### 6.1 Development Fee

We propose a **fixed project fee of ₹1,27,300 (INR)**, covering the full scope described above (Sections 3–5), broken down by phase for transparency:

<!-- | Phase | Fee (INR) |
|---|---|
| 0 — Setup | ₹7,000 |
| 1 — Access & Security | ₹11,000 |
| 2 — Core Data & Purchase Requests | ₹14,000 |
| 3 — RFQ & Vendor Quoting | ₹20,000 |
| 4 — Purchase Orders | ₹13,000 |
| 5 — Delivery & Invoicing | ₹10,000 |
| 6 — Dashboard, PDFs & Polish | ₹14,000 |
| 7 — Launch | ₹7,000 |
| **Total** | **₹96,000** | -->

**Suggested payment schedule:**
- 30% (₹28,800) on signing (project kickoff)
- 40% (₹38,400) at the midpoint (end of Phase 3 — RFQ & Vendor Quoting live)
- 30% (₹28,800) on final delivery (Phase 7 — production launch)

50, 10 20 20
maintainence -> cost lates desided

### 6.2 Post-Deployment Support

**1 month of post-deployment support is included at no additional cost.** For 30 days after production launch, we will:
- Fix any bugs or defects found in the live system
- Assist with any deployment, hosting, or configuration issues
- Make minor adjustments to existing v1 features (e.g. wording, small UI tweaks)

New features, scope changes, or work on the Phase 2 items listed in Section 7 fall outside this support window and would be scoped as a separate engagement. Beyond the included month, ongoing support/maintenance can be arranged on a retainer or as-needed basis.

### 6.3 Ongoing Software Costs — What's Free Now, What's Paid Later

One of the strengths of this architecture is that it costs **nothing to build and demo**, and stays very low-cost once live:

| Service | Free today | Becomes a paid necessity when… | Paid cost |
|---|---|---|---|
| **Vercel** (app hosting) | Free "Hobby" tier during development | Going live for commercial/client use (Vercel's free tier terms are for personal/non-commercial projects) | ~$20/month |
| **Supabase** (database, login, file storage) | Free tier: 500MB database, 1GB file storage — sufficient for development and a small pilot | Production use, to avoid the free tier's auto-pause after a week of inactivity and to get daily backups | ~$25/month |
| **Custom domain** (e.g. procurement.[clientdomain].com) | Not included | If a branded URL is wanted (recommended for a client-facing production tool) | ~$10–15/year |
| **Currency exchange rates** | Free, unlimited (public ECB-sourced daily rate data) | Not expected to ever require a paid upgrade for this system's needs | $0 |
| **SSL / HTTPS security** | Included free | Never — always included | $0 |
| **Source control (GitHub)** | Free private repository | Only if the team later needs advanced collaboration features | Varies |

**Bottom line: development and demo phases run entirely on free infrastructure. Once the system goes live in production, budget approximately $45/month ($20 Vercel + $25 Supabase) in ongoing software costs** — no large upfront infrastructure spend, and no per-user licensing fees.

---

## 7. What's Included in v1 vs. Future Phases

**Included in this proposal (v1):**
- Full Purchase Request → RFQ → Vendor Quote → Purchase Order → Delivery → Invoice workflow
- Secure vendor quoting via one-time links (no vendor accounts needed)
- Self-serve access requests with admin approval
- Multi-currency support with live exchange rates and manual override
- Formal PDF generation for POs and RFQs
- File attachments (invoices, delivery notes, quotes)
- Dashboard with key operational metrics

**Natural next-phase additions (not included in this proposal, available as a follow-on engagement):**
- Per-vessel budget tracking and overspend alerts
- Spend analytics and reporting (by vessel, vendor, category, time period)
- Automated email notifications (RFQ invites, approval alerts)
- Multi-level approval workflows based on PO value
- Expanded role/permission management

---

## 8. Next Steps

1. Review and confirm scope (Sections 3–5) and commercial terms (Section 6).
2. Sign off on the proposal and initial payment to begin Phase 0.
3. Kickoff call to confirm vessel/vendor data to be used for testing, base currency, and the first administrator account.

We're happy to walk through any part of this proposal on a call.

