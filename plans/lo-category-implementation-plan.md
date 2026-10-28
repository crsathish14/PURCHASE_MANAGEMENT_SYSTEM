# LO (Lub Oil) Category Implementation Plan

## Objective

Add **LO (Lub Oil)** as the fourth purchase requisition category. LO follows the existing Stores workflow and conditions from manual PR creation through vendor proforma submission. No IMPA code field or IMPA code content should appear on any LO page or PDF.

Implementation is divided into testable flows. At the end of each flow, stop and let the user test it. Begin the next flow only after the user confirms the current one passes.

## Agreed scope

- Add LO as the fourth category, displayed as **LO** (Lub Oil).
- Carry over the Stores requirements and behavior, including quantity, UOM, ROB, Approved Qty, photos, RFQ issuance, quote pricing, PO quantities, and proforma handling.
- Remove IMPA code from every LO page and PDF, including requested and offered code fields in vendor-facing and staff-facing quote views.
- Do not implement LO Excel import or export templates in this work. They will be handled separately.
- Do not block changing an imported PR's category to LO. Existing Excel import behavior remains available; when the category is changed to LO, the form must present LO's line-item fields.
- Preserve existing category behavior and data for Stores.

## Existing Stores flow reference

The category list is database-driven. Frontend category constants support branching, while `getPresetColumnsForCategory()` defines the Stores preset line-item columns. Stores currently has IMPA/ISSA Code, UOM, ROB, Approved Qty, and Remarks; required Qty is part of the main line-item form. Qty is required when creating a Stores PR, and Approved Qty must be filled on every line before an RFQ can be issued.

The RFQ path issues vendor links, accepts a vendor quotation, presents the received quote for review, and allows staff to award a vendor. Stores vendor quote totals use Approved Qty multiplied by Unit Price. The Purchase Orders flow supports a saved draft, editable needed quantities, issuing a token-based PO, and category-specific PDFs. The vendor then downloads the PO and submits a proforma invoice; staff can view the received invoice.

Relevant current implementation areas include:

- `src/lib/constants/purchase-requisition.ts`
- `src/lib/purchase-requisition/preset-columns.ts`
- `src/lib/validation/purchase-requisition.ts`
- `src/components/purchase-requisition/create-requisition-dialog.tsx`
- `src/components/purchase-requisition/line-items-field.tsx`
- `src/components/purchase-requisition/issue-rfq-dialog.tsx`
- `src/app/[lang]/quote/[token]/page.tsx`
- `src/components/vendor-quote/stores-quote-form.tsx`
- `src/app/api/quote/[token]/submit/route.ts`
- `src/components/rfq/compare-quotes-modal.tsx`
- `src/lib/rfq-quote-pdf/`
- `src/components/purchase-orders/purchase-orders-view.tsx`
- `src/lib/purchase-order-pdf/`
- `src/components/vendor-purchase-order/proforma-invoice-submission.tsx`
- `supabase/migrations/` functions for PR, RFQ quotation, PO draft/issue, and proforma flows

The implementation should check the repository and migrations again at each stage. Category behavior is split across frontend rendering, API validation, database RPCs, and PDF dispatch; support in one layer does not establish support in the others.

## Staged implementation and test gates

### Stage 1 - LO category and PR lifecycle

**Implement**

- Add LO as the fourth category option, using the repository's existing category option conventions.
- Add an LO frontend category constant and an LO preset column set matching Stores except for IMPA/ISSA Code.
- Keep Stores' Qty, UOM, ROB, Approved Qty, Remarks, and photo behaviors for LO.
- Apply the Stores required-Qty validation to LO.
- Verify PR create, detail/read, edit, list display, search/filter, and existing row actions for LO.
- Keep category changes locked after a PR has been saved, following the existing PR edit behavior.
- Leave LO Excel templates and template import/export work out of scope. Do not add a guard that prevents changing a category to LO in the create form after importing another category's template.
- Keep LO's Issue RFQ action unavailable until Stage 2 is implemented, so an LO PR cannot enter the unfinished Stores-shaped RFQ flow.
- Hide the PR Excel Export action for LO until its separate export-template work is implemented.

**User test gate**

1. Create an LO PR manually with multiple line items and the usual Stores fields, leaving optional fields blank where allowed.
2. Confirm no IMPA code field appears, Qty validation works, and Approved Qty can be entered and saved.
3. Reopen and edit the PR; confirm its category and line-item values persist.
4. Check LO in the PR list, category filter, details, and applicable row actions. Confirm Issue RFQ and PR Excel Export are not offered yet.
5. Import an existing category template, change the unsaved PR category to LO, and confirm the category change remains allowed and the form uses LO columns without an IMPA field.
6. Confirm existing Stores PRs and import templates still behave as before.

**Stop:** wait for the user's test result before Stage 2.

### Stage 2 - Issue an LO RFQ

**Implementation status:** Code is ready for the user's Stage 2 test gate. LO quote submission remains unavailable until Stage 3.

**Implement**

- Use the existing UI error handling and authoritative `issue_rfq_link` check. That database function exempts Service only, so its Approved Qty validation already applies to LO.
- Keep the shared RFQ link, expiration, reissue, and PR status behavior working for LO.
- Show an LO read-only vendor RFQ preview with line items, Stores-equivalent dynamic columns, and photos, filtering out IMPA columns.
- Keep quote submission unavailable until Stage 3 so an LO link cannot save a Stores-shaped quotation.

**User test gate**

1. Attempt to issue an LO RFQ with Approved Qty missing from one line; confirm it is rejected with the expected validation.
2. Fill Approved Qty for all lines and issue the RFQ; confirm status and link behavior.
3. Open the vendor link and confirm LO, line descriptions, quantities, UOM, ROB, photos, and other Store-equivalent details appear without IMPA code.
4. Confirm the LO preview has no submission button and direct submission attempts are rejected until Stage 3.
5. Check the existing Stores RFQ path for regressions.

**Stop:** wait for the user's test result before Stage 3.

### Stage 3 - Vendor quote submission

**Implementation status:** Code is ready for the user's Stage 3 test gate.

**Implement**

- Add LO dispatch to the token page, using a vendor form that carries the Stores quote rules and omits IMPA fields.
- Add LO request validation and API schema selection.
- Add explicit LO handling to quote persistence: use Approved Qty and UOM as for Stores, calculate line totals from Approved Qty x Unit Price, and leave requested/offered IMPA values unused for LO.
- Extend database-side unit-price validation to LO so the rule is enforced even when the database RPC is called without the form.
- Keep existing quote attachments, vendor details, quotation summary, and single-use/expiry behavior.

**User test gate**

1. Submit an LO quote with valid line prices; confirm line totals and grand total match the Approved Qty calculations.
2. Try a quote with a missing required Unit Price; confirm it is rejected.
3. Confirm the vendor form contains no requested or offered IMPA field.
4. Confirm the saved LO quote can be loaded for staff review and has no IMPA content to display.
5. Check Stores quote submission and calculations for regressions.

**Stop:** wait for the user's test result before Stage 4.

### Stage 4 - Quote review and award

**Implementation status:** Code is ready for the user's Stage 4 test gate.

**Implement**

- Ensure LO is included in Requested Quote category labels and filters.
- Add LO rendering to quote comparison with the Stores fields and calculations, omitting IMPA code.
- Add LO support to vendor quote PDF export, omitting IMPA code.
- Keep existing award confirmation, awarded status, and list refresh behavior.

**User test gate**

1. Find the LO PR in Requested Quote and filter the list by LO.
2. Open quote comparison; verify every expected field and total, with no IMPA code on the page.
3. Export the vendor quote PDF; verify it has no IMPA code and its totals match the comparison.
4. Award a vendor and confirm the requisition reaches the awarded state and appears in Purchase Orders.
5. Check Stores quote review, PDF export, and award behavior for regressions.

**Stop:** wait for the user's test result before Stage 5.

### Stage 5 - PO draft, issue, and PDFs

**Implementation status:** Code is ready for the user's Stage 5 test gate.

**Implement**

- Include LO in Purchase Orders category filtering and detail dispatch.
- Preserve Stores' needed-quantity editing, same-as-quote-quantity option, draft save/reopen, and quantity validation for LO.
- Ensure PO issue snapshots LO quantities, prices, descriptions, UOM, lead time, and remarks using the Stores rules.
- Add LO handling to staff and vendor PO PDF generation. Both PDFs must omit the IMPA column and any IMPA values.
- Keep the issued vendor link, saved snapshot, and post-issue edit restrictions.

**User test gate**

1. Open the awarded LO record in Purchase Orders and verify the quote details.
2. Save a draft using quote quantities, reopen it, then change needed quantities and save again.
3. Issue the PO and verify the issued quantities and recalculated totals.
4. Download the staff PO PDF and the vendor PO PDF; confirm both have no IMPA field or content.
5. Check Stores PO draft, issue, and PDF behavior for regressions.

**Stop:** wait for the user's test result before Stage 6.

### Stage 6 - Vendor proforma and staff retrieval

**Implementation status:** No code changes required — the entire vendor proforma flow is category-agnostic. All token-based PO lookup, PDF retrieval, proforma signing/upload/submission, and staff retrieval paths have no category guards. `get_purchase_order_by_token`, `submit_purchase_order_proforma`, `get_purchase_order_issue_token`, and `search_purchase_orders` status derivation are all category-agnostic. The vendor PO form (`purchase-order-form.tsx`) renders generically; LO items show no IMPA field. The PO PDF's `hasCodeColumn` already returns false for LO. Code is ready for the user's Stage 6 test gate.

**Implement**

- Verify any category allow-lists in token-based PO lookup and PO PDF retrieval include LO.
- Keep shared token validation, PDF upload/signing, file verification, single-submission, and proforma status behavior working for LO.
- Keep the vendor PO download on the LO page free of IMPA fields and content.
- Keep staff proforma retrieval working after submission.

**User test gate**

1. Open the LO vendor PO link and download the PO PDF; confirm the page and PDF contain no IMPA code.
2. Submit a valid proforma PDF and confirm the vendor reaches the thank-you page.
3. Confirm the token cannot be used for another submission after success.
4. Confirm staff sees the LO order as proforma received and can open the submitted PDF.
5. Check the existing Stores proforma path for regressions.

**Stop:** wait for the user's test result before considering the end-to-end LO flow complete.

## Completion criteria

- The user has confirmed each stage's test gate before the next stage was implemented.
- An LO PR can complete the flow from PR creation through proforma receipt.
- LO has the agreed Stores behavior and validations, without IMPA code on any LO page or PDF.
- LO Excel import/export templates remain deferred to separate work; changing an imported unsaved PR's category to LO remains allowed.
- Existing Stores behavior passes the regression checks listed at each stage.
- Update the applicable `plans/development.md` sections in the same implementation change so the documented category conventions match the completed code and migrations.
