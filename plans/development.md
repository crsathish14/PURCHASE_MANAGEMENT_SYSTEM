# Development conventions

Practical reference for building on this repo — skim before adding a page or route, not a design
doc. Reflects the app as it stands today; update it when a convention changes instead of letting it
drift (a previous version of this file described a planned `CONVENTIONS.md` that was never actually
created — this file is that reference, kept where people will actually find it).

## 1. Stack

Next.js 16 (App Router, Turbopack, TypeScript), React 19, Tailwind v4 (CSS-first `@theme`, no
`tailwind.config.ts`), Supabase (Auth/Postgres/Storage), Zustand, React Hook Form + Zod, npm.

## 2. Next.js 16 gotchas

This is **not** the Next.js in most training data — read `node_modules/next/dist/docs/` before
assuming an API. Two breaking changes already hit in this repo:

- `src/proxy.ts` / `export function proxy` — not `middleware.ts` / `middleware`.
- `error.tsx`'s retry prop is `unstable_retry` — not `reset`.

## 3. Routing & i18n

Every real route lives under `src/app/[lang]/`; `src/proxy.ts` redirects any unprefixed path to
`/en`. `src/lib/i18n.ts` holds the supported-locales list (`isLocale`, `defaultLocale`) — add a
locale by appending here plus a new dictionary. `src/app/global-not-found.tsx` + the
`globalNotFound` flag in `next.config.ts` catch genuinely-unmatched URLs (needed because the root
layout uses a top-level dynamic segment); `[lang]/not-found.tsx` catches explicit `notFound()`
calls within a resolved locale.

**Never hardcode a `/en/...` path.** Import `ROUTES` from `src/lib/routes.ts` — it derives every
path from `defaultLocale`, so a locale change or typo is caught everywhere at once instead of
drifting file by file.

## 4. Design tokens

`src/app/globals.css`'s `@theme` block is the only source of colors/fonts/radii/shadows — always
use the semantic Tailwind classes (`bg-mist`, `text-ink`, `bg-harbor`, `text-rust`, ...), never
hardcode hex. Dark mode is a `[data-theme="dark"]` override of the same custom properties, so it's
automatic — no `dark:` variants needed. Canonical source: `Design-docs/design-spec.html`.

## 5. Component library

- `src/components/atoms/` — reusable primitives (Button, Badge, Input, Textarea, Select, Label,
  Checkbox, Avatar, Spinner, Menu, Dialog, PasswordInput, PasswordStrengthMeter, ImagePreviewModal,
  PhotoThumbnailStack), imported via the barrel: `import { Button, Badge } from "@/components/atoms"`.
- `src/components/<feature>/` — everything else, grouped by feature area: `auth/` (login,
  request-access, change-password forms + shared icons), `staff/` (sidebar, topbar, shell,
  nav-items), `team-access/` (the Team & Access page's view/table/member-dialog — the latter
  handles both inviting a person and resetting a person's password via a `mode` prop).
- `src/app/[lang]/**` holds **only** pages and layouts — no component logic lives there. If a new
  component isn't a page or layout, it goes in `atoms/` (small, reusable, no feature-specific
  logic) or a feature folder (everything else), never inline in the route file.
- Molecules/organisms not yet needed (Table, Drawer, Filter bar, Pagination, Stepper, Empty state,
  Upload dropzone) — build them from atoms when a real page needs them, matching
  `Design-docs/design-spec.html` §05.

## 6. Copy/labels

All UI text lives in `src/locales/en.json`, imported directly (`import en from "@/locales/en.json"`)
and namespaced by page/section. No hardcoded strings in JSX. Add a new top-level key per page.

## 7. Constants

These files hold every value that would otherwise be a magic string:

- `src/lib/constants/profile.ts` — `USER_ROLE` (`ADMIN`/`OFFICER`) and `PROFILE_STATUS`
  (`PENDING`/`ACTIVE`/`DISABLED`). **Never** compare `profiles.role`/`profiles.status` against a raw
  `"admin"`/`"active"`/etc. string literal, and never use one as a Zod enum value, a `<select>`
  option value, or a default form value — import the constant instead. `UserRole`/`ProfileStatus`
  types in `src/lib/types/database.ts` are derived from this file, not redeclared.
- `src/lib/constants/purchase-requisition.ts` — `PR_PRIORITY`, `PR_STATUS`, `DATE_PRESET`,
  `PR_CATEGORY` (`SERVICE`/`STORES`/`SPARES`, mirroring the `category` dropdown field's seeded
  option *values* — used only for frontend conditional branching on which line-item columns to
  show; the DB via `pr_dropdown_fields`/`pr_dropdown_field_options` stays the actual source of
  truth for the dropdown's label/option list), and `PR_LINE_ITEM_PRESET_COLUMN`
  (`REMARKS` — applies to all three categories; `APPROVED_QTY`/`ROB`/`UOM` — Stores and Spares only,
  Service has no Qty concept at all (see `LineItemsField`'s own `isService` flag, which hides the main
  Qty field entirely for this category); `PART_NO` — Spares only; `IMPA_CODE` — Stores only, Spares has
  no IMPA/ISSA code equivalent; `AVAILABLE_ONBOARD` — Service only — the stable keys `LineItemsField`
  uses for its category-driven preset line-item columns, kept distinct from a genuinely user-added
  custom column's random `crypto.randomUUID()` key). The category →
  preset-column-set mapping itself lives
  in one place, `getPresetColumnsForCategory()` in `src/lib/purchase-requisition/preset-columns.ts`
  — both `LineItemsField` (manual create/edit) and the import-template parser (§16) import it, so
  they can't drift apart. `APPROVED_QTY` is office-only (filled in during review, never sourced from
  the import template) but is still part of this set, since the column must exist either way. It's
  also the one preset column `LineItemsField`'s header row never shows an "X" remove button for
  (`line-items-field.tsx`'s `isApprovedQty` check, matched by key **or** label — a saved-and-reloaded
  preset column comes back with its real DB uuid as `key`, not the literal preset string, so the label
  match is what still catches it post-reload) — it can be left blank and saved, it just can never be
  deleted from a Stores/Spares requisition's column set via the UI. `handleRemoveColumn` itself is
  untouched, since the category-switch effect still needs to call it when switching *away* from
  Stores/Spares into Service, which has no Approved Qty column at all.
- `src/lib/routes.ts` — `ROUTES`, every locale-prefixed path the app links to or redirects to (see
  §3).
- `src/lib/constants/storage.ts` — `STORAGE_BUCKET` (currently just `ATTACHMENTS`), `MAX_PHOTO_SIZE_BYTES`,
  `MAX_PHOTO_DIMENSION_PX`, `PHOTO_JPEG_QUALITY`, `ALLOWED_PHOTO_MIME_TYPES`,
  `PHOTO_EXTENSION_BY_MIME_TYPE`, `PR_LINE_ITEM_PHOTO_PATH_PREFIX`, `SIGNED_DISPLAY_URL_TTL_SECONDS` — the
  shared vocabulary every Storage-backed upload feature uses. `MAX_PHOTO_SIZE_BYTES`/`ALLOWED_PHOTO_MIME_TYPES`
  mirror the `attachments` bucket's own `file_size_limit`/`allowed_mime_types` settings for fast
  client-side pre-validation only; the bucket settings themselves (not this file) are the real
  enforcement boundary, since a signed-upload-URL flow means file bytes never pass through our server.
  There is deliberately no photos-per-line-item count limit anywhere in this stack (client
  requirement) — neither this file, the Zod schema, `LineItemPhotosField`'s picker, nor the VBA
  template's own parser cap or truncate the attachments array.
  `PR_LINE_ITEM_PHOTO_PATH_PREFIX` is this feature's own namespace within the shared bucket — a future
  upload feature (e.g. PO documents) adds its own sibling prefix constant here, not a new bucket or a
  new table shape.

## 8. Client state (Zustand)

`src/store/theme-store.ts` and `src/store/toast-store.ts` are the reference pattern for any new
store: plain `create()`, persisted via a custom raw-string `storage` adapter only if the value needs
to survive reloads.

## 9. Toasts

Call `toast.success(message)` / `toast.error(message)` from `@/store/toast-store` in any client
handler; `<Toaster />` is already mounted once in `[lang]/layout.tsx` — never remount it.

## 10. Route-level conventions

`loading.tsx`/`error.tsx`/`not-found.tsx` exist at `[lang]/` as the defaults (reused for every route
unless a segment adds its own more specific one) — follow their exact patterns (`Spinner size="lg"`
for loading, Client Component + `unstable_retry` for error).

## 11. Supabase

- `src/lib/supabase/client.ts` (browser) / `server.ts` (async, Server Components & Route Handlers) —
  the normal cookie-session client, subject to RLS.
- `src/lib/supabase/admin.ts` — service-role client, bypasses RLS entirely. Server-only, never
  imported from a Client Component. Used only where a session-scoped client genuinely can't do the
  job (creating an invited user via `auth.admin.createUser`, an admin resetting another user's
  password via `auth.admin.updateUserById`, clearing a profile's own `must_change_password` flag —
  see the migration comment on why no self-update RLS policy exists). Don't reach for it as a
  shortcut around RLS elsewhere. **Storage uploads are another example of this:** `api/uploads/sign`
  uses the session-scoped `server.ts` client, not `admin.ts`, because the `storage.objects`
  insert/select/delete policies below already grant an active user's own session everything it needs.
- Schema lives in `supabase/migrations/*.sql` — `profiles` table (`admin`/`officer` roles,
  `pending`/`active`/`disabled` status, `must_change_password` flag), RLS (select-own + admin-all,
  admin-update, no client-side self-update/insert/delete), a `storage.attachments` bucket policy.
- **File/image uploads** go through one shared pattern: a private Storage bucket (`attachments`,
  with `storage.buckets.file_size_limit`/`allowed_mime_types` set per-feature — see
  `20260823190000_storage_attachments_policies.sql`), `storage.objects` RLS policies scoped to
  `bucket_id = '<bucket>'` for `authenticated` (insert/select/delete — same "any active user, app
  layer is the real gate" trust model as every `purchase_requisition_*` table's own RLS), and one
  shared signing Route Handler (`src/app/api/uploads/sign/route.ts`) that validates
  `requireApiActiveUser()`, builds the object's Storage path itself from a small validated vocabulary
  (never from a client-supplied path string), and calls `createSignedUploadUrl`. The client PUTs
  bytes straight to Storage with that signed URL/token
  (`supabase.storage.from(bucket).uploadToSignedUrl(...)`) — file bytes never pass through our own
  server, and the existing create/update Route Handlers stay pure JSON. Each entity that owns
  uploads (e.g. `purchase_requisition_line_items` today, via `purchase_requisition_line_item_attachments`)
  gets its own small metadata table (FK to the owning row, `on delete cascade`, RLS matching its
  siblings) rather than one polymorphic `entity_type`/`entity_id` table. What's actually
  centralized/reused is the bucket + path convention + signing route + `src/lib/constants/storage.ts`,
  not the DB table shape.
- **Anonymous-vendor uploads are a second, genuinely different shape of the above** — the vendor RFQ
  quote form (§17) lets an anonymous, token-only vendor (no Supabase session at all) attach their own
  photos per line item. `api/uploads/sign` can't be reused as-is: it hard-gates on
  `requireApiActiveUser()`, and `storage.objects` RLS has no `anon` policy on this or any bucket (by
  design — RLS can't cross-reference a `purchase_requisition_rfq_links.access_token` against the
  request). Instead, `src/app/api/quote/[token]/photos/sign/route.ts` re-validates the token itself
  (via `getRfqQuoteDetailsByToken` — not expired, not yet submitted, and the target line item genuinely
  belongs to that token's requisition) before minting a signed upload URL with the **admin/service-role
  client** (`createAdminClient()`), never a session-scoped one. This is the write-side mirror of
  `rfq-quote.ts`'s own existing read-side pattern (batch-signing *display* URLs via the admin client for
  an anonymous vendor) — same trust model, just for an upload instead of a read. The path convention
  (`RFQ_QUOTE_ITEM_PHOTO_PATH_PREFIX = "rfq-quote-item-photos"`, sibling to `PR_LINE_ITEM_PHOTO_PATH_PREFIX`
  in `src/lib/constants/storage.ts`) uses the RFQ link's own access token as the scope segment instead of
  a separate draft token — it already uniquely and securely identifies the in-progress submission.
  `submit_rfq_quotation` (§17) re-verifies each photo's `storagePath` actually starts with
  `rfq-quote-item-photos/<token>/<line_item_id>/` before persisting its metadata row (`23514` otherwise)
  — the same "don't trust the payload" posture it already applies to `lineItemId` ownership.
- `src/lib/types/database.ts` is a hand-written stub — replace with
  `npx supabase gen types typescript --linked` once the generated output is worth the churn; keep
  `UserRole`/`ProfileStatus` re-exported from `src/lib/constants/profile.ts` either way.

## 12. API routes

- Envelope: `{ data, meta? }` on success, `{ error: { message } }` on failure, with an explicit
  status code — no exceptions.
- Auth: call `requireApiActiveUser()` / `requireApiAdmin()` from
  `src/lib/supabase/require-active-user.ts` as the first line of every handler — they return either
  `{ session }` or `{ error: NextResponse }`; on the latter, `return auth.error` immediately. Don't
  hand-roll the active/admin check inline — that's exactly the duplication these exist to remove.
- Logging: before returning a generic 4xx/5xx for an unexpected failure, `console.error` the real
  error with a `[api/<route>:<method>]` tag first. This writes to the Next.js server's own
  stdout/stderr (your terminal in dev, your host's function logs once deployed) — it is **not**
  Supabase logging. The Supabase Dashboard's Logs only show what happened inside Supabase itself
  (the query/auth call); this is what makes your app's handling of that failure visible too, since
  otherwise it's invisible everywhere.

## 13. Environment variables

Import `env` from `src/lib/env.ts` (client-safe `NEXT_PUBLIC_*` vars) or `serverEnv` from
`src/lib/env.server.ts` (the server-only service-role key, imported only by `admin.ts`). Both throw
a clear error at import time if a var is missing or malformed. **Never** read `process.env.X!`
directly in application code — that fails silently until something downstream produces a confusing
error instead of failing fast with a clear one.

## 14. Before calling a page done

`npm run typecheck && npm run lint && npm run build` must pass. Check the actual rendered output in
a dev server when practical, not just that it compiles.

## 15. Suggested pattern for a new feature page

1. Add copy to `en.json`.
2. Add any new paths to `ROUTES` (`src/lib/routes.ts`) — several already exist as placeholders from
   the nav (`PIPELINE`, `PO_REQUESTS`, `RFQ_LIST`, ...).
3. Build with `atoms/` (+ new feature-folder components under `src/components/<feature>/` for
   anything reusable within that feature but not generic enough for `atoms/`).
4. Route under `[lang]/` — page/layout only, no component logic inline.
5. Wire Supabase reads via `lib/supabase/server.ts`; anything mutating goes through an API route
   using the §12 pattern.
6. Verify per §14.

## 16. Spreadsheet import (generate + parse a template — three independent VBA workbooks)

The Create Requisition "Import Excel" menu (`po-requests-view.tsx`) generates and parses
spreadsheets — `exceljs` is the one dependency for both directions (its `package.json`
`browser`/`main` fields resolve to the right build automatically for a client component vs. a
Route Handler; no separate library needed per side). All three categories now ship a real,
persisted, VBA-driven workbook (the actual paper-form workflow) rather than an ExcelJS-generated
one:

**Every category — a persisted, VBA-driven workbook (the real paper-form workflow)**
- `GET src/app/api/purchase-requisitions/import-template/route.ts?category=stores|spares|service`
  streams a static `.xlsm` straight off disk (`readStoresTemplateBuffer()` /
  `readSparesTemplateBuffer()` / `readServiceTemplateBuffer()` in
  `src/lib/purchase-requisition/templates/index.ts`) — each workbook has a real VBA macro project
  (Add Line Item button, Ctrl+V photo-paste into a "SUPPORTING PHOTOS" table, sheet protection),
  which ExcelJS (or any generic spreadsheet library) cannot safely author, so none is regenerated
  per request. The three are entirely independent VBA projects (separate constants module, separate
  worksheet name, no shared state) that happen to share the same proven architecture — Spares was
  built second reusing every fix learned from Stores, and Service third reusing every fix learned
  from both. Each binary (`templates/requisition-form-{stores,spares,service}.xlsm`) and its
  readable VBA source + setup guide (`templates/vba-source/{stores,spares,service}/`) are checked
  in; a filled sample (`*.sample.xlsm`) is kept alongside each as a manual test fixture — Service's
  is ~4MB (real embedded photos, not tiny placeholders like the other two), checked in as-is rather
  than trimmed down. Regenerating any file means re-running its own setup guide's steps in Excel and
  replacing the binary.
- Each format is told apart by sheet name — `"Stores Requisition Form"` / `"Spares Requisition
  Form"` / `"Service Requisition Form"` — all three containing a "Vessel Name" label
  (`parseRequisitionTemplateFile`, the dispatcher in `import-template.ts`). The Stores sheet name
  (and its labels) changed once already between the template's first and second real-world
  revisions — v1 files are no longer recognized at all, since the paper form itself was revised and
  this was a full replacement, not a versioned dual-format dispatch.
- **Parsing logic is split by what's actually shared.** Everything generic — merge-aware label→value
  lookup (a label can itself be a multi-column merge, e.g. "IMO No" spans two columns, so its value
  starts one column past the end of the label's own merge, not simply "one cell right"), dynamic
  table-section sizing (`getMergeRowSpan()`, read from actual merges rather than a hardcoded offset —
  the SUPPORTING PHOTOS heading grew from 1 row to 2 between Stores' own revisions, and Service's
  line-item header spans 3 rows instead of the usual 2, both survived automatically with zero parser
  changes because of this), and photo-anchor extraction (images are matched to a line item by joining
  the SUPPORTING PHOTOS table's embedded-image drawing anchors — never its "N photos" counter text,
  which is not authoritative — against each line item's Sl No., including continuation rows once a
  line item has more than 7 photos, verified directly against Service's own sample where one line
  item has 8 photos spanning such a continuation row; there is no cap on how many are imported per
  line item, by design) — lives once in `import-template-vba-shared.ts`. Each format's own thin
  parser (`import-template-vba.ts` for Stores, `import-template-vba-spares.ts` for Spares,
  `import-template-vba-service.ts` for Service) supplies only what's genuinely different: its own
  label text, its own line-item column set, and its own output shaping (category, and — Spares and
  Service — the Equipment Details fields). Two things no parser hardcodes, because the Stores
  template has already changed them once:
  - **Table section heights**, per the `getMergeRowSpan()` point above.
  - **The photo slot count** (currently 7, `FALLBACK_SLOT_COLUMNS`/`SLOT_COUNT` in the shared module)
    is discovered by scanning the header for `"Photo N"` labels, with the hardcoded array only as a
    fallback — it was 5 in Stores' first template revision; Spares and Service both launched directly
    with 7.
  - All three templates share one more internal inconsistency worth knowing about if this ever needs
    debugging again: the Sl No. column is labeled `"Sl No."` in the line-items table but `"Sl.No."`
    (no space) in the photo table — matched via a small regex (`isSlNoLabel`), not exact equality.
    Separately, `"SUPPORTING PHOTOS"` (the photo table's own heading) and `"Supporting Photos"` (the
    line-items table's own per-row input-cell column label) normalize to the *same* string — the
    heading is found via a column-A-only search (`findLabelCellInColumn`, mirroring each format's own
    VBA `FindRowByLabel`, which only ever searches `COL_SLNO`) specifically to avoid matching the
    wrong one, since a full-sheet search would hit the (earlier, row-wise) column label first.
- Stores' and Spares' "Supply Port" header field maps to the app's `requiredPort` — Service's
  equivalent field is labeled `"Service Port"` instead (a different hardcoded label string local to
  that one parser, same target field). All three templates' footer "Requisitioned by:" / "Approved
  by:" fields map to `requisitionedBy`/`captainChiefEngineer` (the DB column name predates this
  label; the paper form's own wording for the second field has already changed once, from "Captain /
  Chief Engineer:" to "Approved by:" — the column was kept as-is since it's an internal identifier,
  only the UI label (`en.json`'s `captainChiefEngineer` key) was updated to track the current paper
  form's wording). Spares' and Service's templates additionally have an Equipment Details section
  (Name of Equipment/Type/Make/Sr. No./Model/Specifications/Any Other details), which Stores has no
  equivalent of — mapped straight to the matching `equipment*` form fields (same merge-aware lookup),
  and rendered in `CreateRequisitionDialog` for both those categories, not just on import.
- Service's line-items table is simpler than Stores/Spares — no Qty, Part No., UOM, or ROB column at
  all, since a service isn't quantified the way a stores/spares part is (`LineItemsField`'s own
  `isService` flag already hides the main Qty field entirely for this category). It has one column
  neither other format has instead: **Available Onboard (Y/N)** (plain text, no dropdown validation
  — `PR_LINE_ITEM_PRESET_COLUMN.AVAILABLE_ONBOARD`, Service-only, see §7).
- Vessel is matched via the file's **IMO No** (not vessel name), the same way in every format:
  resolved against `getVessels()` (`src/lib/data/vessels.ts`), then the matched vessel's name is
  matched against the "vessel" dropdown field's options — `pr_dropdown_field_options` and `vessels`
  remain fully decoupled tables; the parser just chains two lookups. An unmatched IMO leaves Vessel
  blank with a warning, same graceful degradation as an unrecognized dropdown value.
- Extracted photos aren't real attachments yet when a parser returns them
  (`ParsedImportResult.pendingLineItemPhotos`, a `Map<lineItemIndex, {blob, fileName}[]>`) — they
  still need to go through the same sign→`uploadToSignedUrl` pipeline a manual pick uses
  (`uploadLineItemPhoto()` in `upload-line-item-photo.ts`, shared with
  `LineItemPhotosField`/`resizeAndReencode()` in `photo-processing.ts`). `po-requests-view.tsx`'s
  `handleImportFilePicked` runs that upload loop (under a fresh draft token, uploading every
  extracted photo with no per-line-item count limit) before opening the dialog, then passes that
  same token as `initialDraftToken` so the dialog's own `scopeId` matches.

**Legacy ExcelJS-generated format (retired, parser kept for old downloads)**
- Before Stores and Spares moved to a persisted VBA workbook (Service never had this format — it
  launched directly as VBA-only), the download route built a workbook live from
  `getPrDropdownFields()` and marked it with a hidden `veryHidden` `_pms_meta` sheet (cell `A1` =
  `pms-pr-template:<category>:v1`) so the parser could confirm a file really was one of these
  templates. The route no longer generates this format for any category, but
  `parseRequisitionTemplateFile` still checks for the marker sheet first and, if present, hands off
  to `parseLegacyWorkbook` — purely so a Stores/Spares file someone already downloaded before that
  switch keeps working. Header fields there are matched by **label text**, not fixed cell refs (scans
  every cell, pairs each known label with whatever's immediately to its right — this "immediately
  right" rule assumes an unmerged/single-column label, unlike the VBA formats' merge-aware lookup
  above).

**Shared across every format**
- `import-template-shared.ts` holds what every parser needs: `cellText()`, `matchDropdownOption()`,
  and the `ParsedImportResult`/`ParseImportError` types.
- Parsed output feeds `CreateRequisitionDialog`'s `initialImportValues` prop, which seeds the normal
  create form — nothing is written to the DB until the user reviews and Submits through the existing
  POST `/api/purchase-requisitions` path. Because this dialog instance is mounted once and persists
  across open/close cycles, `initialImportValues` changing does **not** by itself reach an
  already-constructed `useForm()` — an explicit `reset(defaultValues)` in a `useEffect` keyed on
  `initialImportValues` is required (react-hook-form only consumes `defaultValues` at first
  construction). A future upload-a-file-and-prefill-a-form feature should follow this same shape.
- **Not every preset column is importable.** Every parser always sets `columns` to the category's
  full `getPresetColumnsForCategory()` set (§7), not just whatever headers the file had — so a
  column like Approved Qty that a template deliberately omits (office-only, filled in during review)
  still exists after import, just blank.

## 17. Vendor RFQ quote submission (Stores — first of three categories)

The vendor-facing side of `purchase_requisition_rfq_links` (§11's own bullet on the file-upload
pattern is the closest sibling precedent for "one shared plumbing, reused across the app"). The link/
token/expiry mechanism itself (`issue_rfq_link`, `get_rfq_link_by_token`, `submit_rfq_link`, all in
`20260824030000_rfq_link_rpcs.sql`/`20260825010000_rfq_link_expiry_datetime.sql`) is untouched by
this feature — everything below is additive, sitting alongside it.

- **New tables** (`20260830010000_purchase_requisition_rfq_quotations.sql`):
  `purchase_requisition_rfq_quotations` (one row per vendor submission, 1:1 with its
  `rfq_link_id`, denormalizing `requisition_id` for direct queries) and
  `purchase_requisition_rfq_quotation_items` (one row per quoted PR line item, snapshotting
  `requested_description`/`requested_impa_code`/`approved_qty`/`uom` at submission time alongside a
  `line_item_id` FK, so a quotation stays traceable to exactly what was quoted against). Both use
  `numeric(14,2)` for money/qty columns — a deliberate departure from this schema's usual
  all-`text` line-item values, since these are genuinely summed/computed server-side. RLS matches
  every sibling `purchase_requisition_*` table (`select to authenticated using (true)`, no anon
  policy, no insert/update/delete policy — all writes go through the RPC below).
- **New RPCs** (`20260830020000_rfq_quotation_rpcs.sql`):
  - `get_rfq_quote_details_by_token(p_token)` — a superset of `get_rfq_link_by_token`'s own return
    shape (same link-identity fields) plus the PR header fields and every line item (dynamic
    columns flattened to `{label, value}` pairs, plus each attachment's raw `storage_path` — never
    a signed URL; Storage's `createSignedUrls` isn't callable from SQL). Vessel name/IMO No.
    require a two-hop resolution since `purchase_requisitions` has no `vessel_id` FK at all —
    vessel is a dropdown option value (slug); the option's *label* is matched against
    `vessels.name` to reach `vessels.imo_no`, the same relationship `add_vessel()` establishes when
    a vessel is first added.
  - `submit_rfq_quotation(...)` — copies `submit_rfq_link`'s atomic single-use+expiry gate inline
    (not by calling it) so the gate, every item insert, and the recalculated total commit or roll
    back as one transaction. Currency is never a parameter — always inserted as `'USD'`. Approved
    Qty/IMPA Code/UOM are never accepted from the vendor's payload either: each is looked up here,
    live, by exact label match against the requisition's own line-item columns (`c.label =
    'Approved Qty'`, etc.) — the same "match by exact label, not a stable key" approach
    `line-items-field.tsx` already relies on client-side, since a column's only persisted identity
    is its own DB uuid + label (see §7's `PR_LINE_ITEM_PRESET_COLUMN` and
    `getPresetColumnsForCategory()` in `src/lib/purchase-requisition/preset-columns.ts` for where
    those exact label strings come from). This is what makes "the vendor can't change Approved Qty"
    actually true server-side, not just a disabled input client-side.
  - Both are `security definer`, `grant ... to anon, authenticated` — same pattern as
    `get_rfq_link_by_token`/`submit_rfq_link`, since a vendor has no session for RLS to scope
    anything to.
- **Signing photos for an anonymous vendor** (`src/lib/data/rfq-quote.ts`): the RPC above returns
  raw `storage_path`s; batch-signing them into display URLs needs `src/lib/supabase/admin.ts`'s
  service-role client, since storage RLS is `authenticated`-only and a vendor has no session for a
  normal signed-URL call to be scoped to. This is the read-side mirror of the "session-scoped
  client genuinely can't do the job" cases §11 already documents — narrowly used here, only to sign
  paths the token-validated, requisition-scoped RPC call already returned.
- **Category-driven, shared-backend architecture** — the same "shared plumbing, category-specific
  renderer" shape as §16's import templates: `get_rfq_quote_details_by_token` is fully
  category-agnostic (it returns whatever columns/line items exist for any PR), and
  `src/app/[lang]/quote/[token]/page.tsx` branches purely on the returned `category` to decide
  which form component to render — `stores` → `StoresQuoteForm`
  (`src/components/vendor-quote/stores-quote-form.tsx`), anything else → the original generic stub
  `QuoteForm`. Adding Spares/Service forms later needs no backend changes, only new sibling
  components following `StoresQuoteForm`'s pattern (its own category-specific bits — which columns
  to surface as locked fields, which labels to match on — are the only genuinely Stores-specific
  code in this feature).
- **Photo thumbnails — shared between the editable and read-only views.** `PhotoThumbnailStack`
  (`src/components/atoms/photo-thumbnail-stack.tsx`) renders 0-1 photos as a single square tile and
  2+ as one collapsed stack tile (front photo, thin peeking edges behind it, a count badge) rather
  than a growing row of squares — used by both `LineItemPhotosField` (the office-side create/edit
  form, `src/components/purchase-requisition/line-item-photos-field.tsx`) and this file's own
  `ItemPhotos`, so a line item with many photos looks and behaves the same on both sides of the RFQ
  link. Selecting the tile always opens `ImagePreviewModal` at the front photo. The one difference
  between the two call sites is `onRemove`: `LineItemPhotosField` passes one (its own `removeDone`,
  gated on its `disabled` prop) since it's editable, so a delete button appears in the gallery
  toolbar; `ItemPhotos` never passes one, since a vendor can only view the requisition's own photos,
  never remove them. `ImagePreviewModal` itself derives its displayed index fresh from `images`
  every render (rather than mirroring it into state via an effect) precisely so it stays correct —
  and closes cleanly instead of getting stuck — when `onRemove` shrinks the array while it's open.
- React Hook Form gotcha worth knowing if this file's pattern is reused: don't `useMemo` a
  computed value keyed on a `watch()` return for a nested array path — `watch("items")` doesn't
  reliably return a referentially-new array on every change, so the memo can silently stop
  recomputing after the first render. `stores-quote-form.tsx`'s row-total/grand-total calculation
  is deliberately a plain (unmemoized) computation for exactly this reason.
- **Delivery Lead Time is digits-only** (`vendorQuoteItemSchema.deliveryLeadTime` in
  `src/lib/validation/vendor-quote.ts`, `/^\d+$/`, same optional-if-empty shape every other item field
  already has) and its column header reads "Delivery Lead Time (In Days)" — product decision, since the
  field is always a whole number of days. **Approved Qty's vendor-facing header was separately renamed
  to "Qty"** — display-only, `en.vendorQuote.storesForm.itemDetails.columns.approvedQty`, NOT
  `presetColumnsCopy.approvedQty` (`en.staff.poRequests.createDialog.columns.approvedQty`), which stays
  `"Approved Qty"` unchanged since `stores-quote-form.tsx`'s own `APPROVED_QTY_LABEL` uses that exact
  string to look up the line item's value by label match against the DB-stored column — renaming it
  would have silently broken that lookup. Both `stores-quote-comparison-card.tsx` (§18) and the vendor
  form read the same renamed header key, so both updated from one locale edit.
- **Unit Price accepts any number of decimal places** (`vendorQuoteItemSchema.unitPrice`,
  `/^\d+(\.\d+)?$/` — was `/^\d+(\.\d{1,2})?$/`, a 2dp cap) — product decision, some vendors quote
  fractional-cent unit prices. Note this is purely an input-acceptance change: `total_price`/
  `unit_price` are still stored as `numeric(14,2)` (`purchase_requisition_rfq_quotation_items`), so a
  more-than-2dp value is still rounded at the DB boundary — only the *validation* was ever rejecting
  it outright before this change.
- **Vendor-attached photos per line item** — a new column, `t.itemDetails.columns.vendorPhotos`
  ("Attach Photos"), after Remarks in `stores-quote-form.tsx`'s item table, genuinely distinct from the
  existing read-only Photos column (the office's own reference photos for that item, untouched). Backed
  by a new table, `purchase_requisition_rfq_quotation_item_photos` (FK to
  `purchase_requisition_rfq_quotation_items`, `on delete cascade`, RLS matching every sibling
  `purchase_requisition_rfq_quotation*` table exactly — `select to authenticated`, no anon policy, no
  insert/update/delete policy since the only write path is `submit_rfq_quotation` itself). See §11's
  "Anonymous-vendor uploads" bullet for the new signing mechanism this needed (an anonymous vendor has
  no session, so `api/uploads/sign` couldn't be reused). Frontend: `VendorItemPhotosField`
  (`src/components/vendor-quote/vendor-item-photos-field.tsx`) is a trimmed clone of
  `LineItemPhotosField`'s exact pending/uploading/error tile UX and reuses its micro-copy verbatim
  (`en.staff.poRequests.createDialog`) — simplified because every photo here was uploaded in *this*
  browser session (a vendor never reloads mid-quote), so `previewUrl` is just the local blob URL for the
  field's whole lifetime, no separate "already has a real signed display URL" bookkeeping needed. Not
  RHF-registered (same reasoning `LineItemPhotosField` isn't either) — tracked in `StoresQuoteForm`'s own
  `photosByIndex` state and merged into each item's payload only at submit time, so
  `vendorQuoteItemSchema`'s `photos` field is always populated (possibly `[]`) by the time the server
  re-validates the full request body. No cap on count per line item, matching this codebase's existing
  explicit "no photos-per-line-item limit, by design" convention (§7) for the office-side equivalent.
  Also surfaced to staff as a new "Vendor Photos" column in `stores-quote-comparison-card.tsx` (§18) —
  `getRfqQuoteComparison()` fetches and signs these the same way it already does the office's own
  reference photos (one shared `createSignedUrls` batch call across both sets, session-scoped client),
  reusing that file's existing local `ItemPhotos` component as-is.

## 18. Requested Quote page (RFQ progress tracking)

A staff-facing list of PRs that have had an RFQ issued to at least one vendor, showing per-PR quote
progress (`{received} of {total}`) and a derived 3-state status. Lives at the pre-existing
`ROUTES.RFQ_LIST` (`/en/rfq-list`) slot, which already had a nav entry and route constant reserved
for it — only the route itself was unbuilt until now. Sits alongside §17's vendor RFQ/quote-submission
plumbing rather than duplicating it — this page is a read-only aggregation over
`purchase_requisition_rfq_links`/`purchase_requisition_rfq_quotations`, with no new write path.

- **New view**, `pr_rfq_progress` (`20260911010000_pr_rfq_progress_view.sql`) — one row per
  requisition with ≥1 issued RFQ link (grouped `from purchase_requisition_rfq_links`, not left-joined
  off `purchase_requisitions`, so a PR with zero links structurally produces no row here), with
  `vendor_count`, `quote_count`, `first_issued_at` (`min(created_at)` across that PR's links), and a
  precomputed `derived_status`. Carries no RLS/GRANT of its own, same as `pr_requisition_list` —
  access flows from the querying role's existing `select to authenticated using (true)` policies on
  the two underlying tables.
- **New RPC**, `search_requested_quotes` (`20260911020000_search_requested_quotes_rpc.sql`) — the
  list page's equivalent of `search_purchase_requisitions`: same search/filter/pagination/
  `count(*) over()` shape, joined to `pr_rfq_progress` (which is what enforces "≥1 RFQ issued," not a
  `where` clause) and always excluding `status = 'cancelled'` (a PR that was cancelled after RFQs went
  out never appears here — a deliberate scope decision, since this page tracks the active pipeline,
  not a full history). Its date filter runs against `first_issued_at`, not the PR's own `created_at`,
  since that's this page's own displayed date column.
- **Derived status** — `REQUESTED_QUOTE_STATUS` (`src/lib/constants/requested-quote.ts`):
  `RFQ_ISSUED` (0 received) / `PARTIAL_RECEIVED` (0 < received < total) / `ALL_RECEIVED`
  (received = total). Computed once, in SQL, inside `pr_rfq_progress` — never re-derived client-side
  or read from `purchase_requisitions.status` (that column alone can't distinguish 1-of-3 from 3-of-3,
  since both read as `quotes_received` — see §17's note on `submit_rfq_quotation`'s single-first-
  submission semantics). Values are deliberately distinct strings from `PR_STATUS`'s own — a different
  concept that happens to share a name, never compare one against the other.
- **Data access / API**: `src/lib/data/requested-quotes.ts` (`getRequestedQuotes`) →
  `GET /api/requested-quotes`, following §12's conventions exactly (hand-parsed coerce-never-fail
  query params, `{data, meta}`/`{error}` envelope, `requireApiActiveUser()`). No PG-error-code mapping
  needed — pure read, no mutation path.
- **Frontend**: `src/app/[lang]/(staff)/rfq-list/page.tsx` + `src/components/rfq/`
  (`requested-quote-view.tsx`, `rfq-table.tsx`, `rfq-toolbar.tsx`, `rfq-pager.tsx`,
  `rfq-empty-state.tsx`, `date-range-filter.tsx`) — a trimmed clone of the Purchase Request list
  page's own structure (same staged/applied filter split, same `requestIdRef` stale-response guard,
  same retry-at-page-1-on-overrun). `FilterMultiselect` is imported directly from
  `purchase-requisition/` rather than cloned — unlike `date-range-filter.tsx`, it has no copy baked
  in (fully prop-driven), so duplicating it would only add drift risk for no benefit. Row click
  originally reused `CreateRequisitionDialog` (the read-only PR detail view); this was replaced by
  the RFQ vendor management dialog described below, since a PR's own fields aren't what this page's
  users need to see when they click through — see that bullet.
- **New atom**, `QuoteProgress` (`src/components/atoms/quote-progress.tsx`) — the
  "`{received} of {total}`" fraction + progress bar (track `bg-line`, fill `bg-teal` while partial →
  `bg-moss` at 100%), replicating the design doc's `.frac` component (`Design-docs/app/rfq-list.html`).
  Kept fully generic/prop-driven (no PR-specific typing) since any future "N of M" progress display
  can reuse it.
- **Naming note**: the design doc and this page's pre-existing nav/route slot both used "Request for
  Quote" — relabeled to "Requested Quote" (`staff.nav.rfq`, `staff.requestedQuote.title` in
  `en.json`) per product decision; the static design mock's own on-page strings were left as-is (a
  reference file, not live copy).
- **RFQ vendor management dialog** (`src/components/rfq/rfq-links-dialog.tsx`) — what a row click
  actually opens now: every vendor ever invited to that PR's RFQ, with issue/received dates, their
  shareable link (copy-to-clipboard), a per-vendor-link status, and a **Reissue** action. This is a
  genuinely different 3-state concept from the page's own `REQUESTED_QUOTE_STATUS` (a per-PR
  aggregate) — kept in its own constant, `RFQ_LINK_STATUS`
  (`src/lib/constants/rfq-link.ts`: `PENDING` / `QUOTE_RECEIVED` / `EXPIRED`), derived from
  `submitted_at`/`expires_at` in `src/lib/data/rfq-links.ts`'s `getRfqLinksForRequisition` (two flat
  queries joined in JS — `purchase_requisition_rfq_quotations` already denormalizes `requisition_id`
  for exactly this, so no nested-embed/PostgREST-shape guesswork is needed, same reasoning
  `getPurchaseRequisitionById` already documents for its own attachments query). Follows the exact
  fetch-by-id-then-open pattern `CreateRequisitionDialog` itself used to use (parent fetches via a new
  `GET` on `api/purchase-requisitions/[id]/rfq-links` before the dialog opens, row shows the same
  `detailLoadingId` cursor meanwhile) — the dialog component itself is purely presentational, no
  fetching of its own. This split isn't just style: an internal `useEffect(() => { fetchLinks() }, [])`
  was tried first and hit this repo's `react-hooks/set-state-in-effect` lint rule as a hard error, not
  a warning — fetch-on-mount-via-effect has no precedent anywhere else in this codebase, and the
  fetch-before-open pattern already established for `CreateRequisitionDialog` sidesteps the rule
  entirely by triggering the fetch from an event handler instead.
- **Reissue** (`reissue_rfq_link`, `20260911040000_reissue_rfq_link_rpc.sql`, corrected by
  `20260911050000_fix_reissue_rfq_link_ambiguous_id.sql`) — one atomic RPC, not two separate
  actions: expires the vendor's current link (`expires_at = now()`, only ever moving it earlier) and
  inserts a fresh one for the same vendor, in one transaction, mirroring `issue_rfq_link`'s own guard
  style. Refuses to reissue a link that already has a submitted quote (`55000`) — that's not a stale
  invite, it already did its job. No distinction between "expired naturally" and "expired because an
  officer reissued it" — both are just `expires_at < now()`, no new column. **Gotcha hit and fixed
  during manual verification**: `returns table (id uuid, access_token text)` implicitly declares `id`
  as a PL/pgSQL variable visible through the whole function body, so an unqualified
  `where id = p_link_id` in the expire-step UPDATE was ambiguous (`42702`) against
  `purchase_requisition_rfq_links.id` — exactly the pitfall `issue_rfq_link`'s own status-flip UPDATE
  already fully-qualifies its columns to avoid. Any new RPC whose `RETURNS TABLE` column names
  overlap with a table it writes to needs the same qualification.
- **`pr_rfq_progress` counts distinct vendors, not raw link rows** (fixed by
  `20260911030000_pr_rfq_progress_distinct_vendors.sql`, `create or replace view`, column
  names/types unchanged so nothing downstream needed to change) — necessary once reissue can create a
  second link row for the same vendor, or "X of Y" would inflate by one on every reissue. Grouping is
  by `vendor_email` (not `vendor_name`, which can vary run to run for the same real vendor — confirmed
  against live data where this had already silently happened before this fix: one PR's `vendor_count`
  dropped from 9 raw link rows to 2 real distinct vendors once corrected). `first_issued_at` stays
  correct across a reissue for a subtler reason: expiring a link only changes `expires_at`, never
  `created_at`, so `min(created_at)` across a vendor's old-and-new links is still the true first-ever
  invite date. A reissue changes none of `pr_rfq_progress`'s output for its PR — same `vendor_email`
  still counted once, `quote_count`/`derived_status` unaffected, `first_issued_at` unmoved — so
  `requested-quote-view.tsx` deliberately never refetches the main list after one; only the vendor
  dialog's own list refetches, via an explicit `onReissued` callback (not another effect).
- **`issue_rfq_link` rejects a duplicate vendor email on the same requisition**
  (`20260911060000_restrict_duplicate_rfq_vendor_email.sql`, a new `55001` errcode distinct from the
  existing `55000` "wrong requisition status" conflict, mapped to its own message in
  `rfq-links/route.ts`) — found live: an officer using the plain Issue RFQ form (not Reissue) to
  invite what they intended as a second vendor, but reusing the same email, silently created a second
  link that `pr_rfq_progress`'s distinct-vendor counting then correctly collapsed into "still 1
  vendor" — confusing, since nothing on screen explained why the fraction hadn't moved. This blocks
  that state from occurring at all rather than only explaining it after the fact: once an email has
  any link on a requisition, a further plain Issue RFQ to that same email is rejected — Reissue is the
  one remaining path for "invite this vendor again," and it isn't affected by this new check since
  `reissue_rfq_link` is a fully separate function body, not a wrapper around `issue_rfq_link`. Compared
  case-sensitively, deliberately consistent with `pr_rfq_progress`'s own `vendor_email` grouping
  (neither normalizes case) rather than fixing it in only one of the two places that key off this
  column.
- **Reissue hard-deletes the old link** (`20260912010000_reissue_deletes_old_link.sql`) — was
  `update ... set expires_at = now()`, now `delete`. "Expired" is reserved for a link that genuinely
  ran out its own clock with no officer intervention; a reissued-away link isn't that, and showing it
  as "Expired" alongside links that actually timed out was misleading. Safe to hard-delete because the
  function's own guard already confirms `submitted_at is null` before reaching this point — no
  `purchase_requisition_rfq_quotations` row ever references the deleted id. **Known, accepted
  side effect**: `pr_rfq_progress.first_issued_at` is `min(created_at)` over whatever rows currently
  exist, so if the reissued link happened to be the PR's chronologically-first invite, that column can
  advance forward once the old row is gone, rather than continuing to reflect the true original issue
  moment — accepted in favor of never mislabeling a reissued link as "Expired." The vendor list
  dialog's Copy action is also now hidden (not just inert) once a link's status is `QUOTE_RECEIVED` or
  `EXPIRED` — copying a link nobody can use anymore isn't a real action, and hiding it keeps the row's
  remaining state (a Badge and, only if still resendable, a disabled/enabled Reissue button) the whole
  story instead of a stray button that does something pointless.
- **Compare Quote moved from the main table into the vendor list dialog, as a selection, not a
  per-row action.** The list page's own `compareQuote` column (a permanently-disabled placeholder
  button, `rfq-table.tsx`) is removed outright — comparing quotes is a cross-vendor action, so it
  never belonged on a single PR row to begin with. `rfq-links-dialog.tsx` now has a leading checkbox
  column, enabled only when a row's status is `QUOTE_RECEIVED` (there's nothing to compare for a
  `PENDING` or `EXPIRED` link) and capped at 3 selections at once (`MAX_COMPARE_SELECTION`) — once 3
  are checked, every other eligible checkbox disables until one is unchecked. A **Compare Quote**
  button sits in the dialog footer beside Close, disabled until at least one row is selected. Its
  `onClick` is intentionally a no-op for now (`handleCompare`, a stub) — the actual comparison screen
  is a future feature; this just gets the selection UX and its enablement rules in place ahead of it.
  Selection state (`selectedIds`) lives in the dialog and needs no manual reset logic: the dialog is
  already remounted per PR via `requested-quote-view.tsx`'s `key={selectedRow?.id ?? "closed"}` (see
  above), so a fresh open always starts with nothing selected.
- **Reissue CTA visibility now mirrors Copy's, inverted** — shown only for `EXPIRED` and
  `QUOTE_RECEIVED` links, never `PENDING`. A still-pending link already has a working Copy button for
  resending the exact same invite, so a second, different action to generate a brand-new link for it
  had no real use case; Reissue is reserved for the two states where Copy is hidden because the
  existing link genuinely can't be reused (`rfq-links-dialog.tsx`'s `row.status !== RFQ_LINK_STATUS.PENDING`
  guard on the button, replacing the old always-rendered-but-disabled-for-`QUOTE_RECEIVED` version).
- **Reissuing a `QUOTE_RECEIVED` link is now allowed, gated by a confirmation warning instead of a
  hard backend block.** Product decision, reversing the original design: an officer can need a revised
  quote from a vendor who already responded (pricing changed, items added, etc.), and Reissue is the
  supported path for that. `reissue_rfq_link` (`20260912020000_allow_reissue_after_quote_received.sql`)
  drops the `v_old_submitted_at is not null` guard entirely — the RPC no longer distinguishes a
  never-submitted link from a submitted one, it just deletes-and-reissues either way, same as it
  already did for `PENDING`/`EXPIRED`. Because that delete cascades
  (`purchase_requisition_rfq_quotations.rfq_link_id ... on delete cascade`, `20260830010000`), reissuing
  a `QUOTE_RECEIVED` link permanently destroys the vendor's already-submitted quotation and every one of
  its quotation_items — accepted as the intended effect (the officer is asking for a fresh quote to
  replace the old one, not to keep both; keeping both would also leave `pr_rfq_progress`'s distinct-vendor
  `quote_count` wrongly still counting this vendor as "quoted" against their new, unsubmitted link). This
  is exactly the kind of one-way data loss that needs an explicit "are you sure" step before it happens,
  not a hard block — so the gate moved from the database to the client: `rfq-links-dialog.tsx` now opens
  `ReissueWarningDialog` (new, `reissue-warning-dialog.tsx`, following the same small
  confirm/cancel-`Dialog` shape as `purchase-requisition/cancel-pr-dialog.tsx`) when Reissue is clicked
  on a `QUOTE_RECEIVED` row; only confirming it opens the normal `ReissueRfqDialog` form. Clicking
  Reissue on an `EXPIRED` row skips the warning and opens `ReissueRfqDialog` directly, same as before —
  there's no existing quote to lose there.
- **Compare Quotes modal** (`rfq-links-dialog.tsx`'s Compare Quote button, previously a no-op stub) —
  a full-viewport modal (`src/components/rfq/compare-quotes-modal.tsx`), not a page navigation. A first
  version used a dedicated route (`/rfq-list/compare/[requisitionId]`); the user rejected that after
  trying it ("taking me to some other path") and asked for an in-place modal instead, so that route was
  removed entirely — `getRfqQuoteComparison()` (below) is now called from a new API route instead of a
  Server Component page. `rfq-links-dialog.tsx`'s `handleCompare()` fetches
  `GET .../rfq-links/compare?linkIds=a,b,c` (new route,
  `src/app/api/purchase-requisitions/[id]/rfq-links/compare/route.ts`) before opening the modal — same
  fetch-then-open pattern this file's own parent already uses for opening *this* dialog, so
  `CompareQuotesModal` itself stays purely presentational.
  - **Layout**: also revised after live feedback. When first asked to choose between a shared
    metrics-comparison table (vendors as columns, one row per metric — matching the *other*, unused
    design mockup at `Design-docs/app/compare-quotes.html`) and three full read-only copies of the
    Stores vendor quote form, the user chose the latter. Built as a full-page horizontal-scrolling row
    first — but that didn't fit a normal screen width (each form's own item table alone needs ~1100px)
    and required navigating away, both of which the user then asked to fix. Landed on: a near-fullscreen
    modal (`fixed inset-0` with a small gutter, not the centered/max-width `Dialog` atom every other
    dialog uses — even `xl`'s 1200px cap is too narrow for this) laid out as a CSS grid with exactly N
    equal-width columns (`grid-cols-1`/`-2`/`-3` picked by vendor count) so all selected vendors are
    visible at once with **no horizontal scrolling of the set** — each column (`StoresQuoteComparisonCard`
    itself, `h-full overflow-y-auto`) scrolls independently instead, and the item table inside a column
    keeps its own already-existing `overflow-x-auto` for its own width overflow.
    `src/components/rfq/stores-quote-comparison-card.tsx` is a read-only clone of
    [`stores-quote-form.tsx`](src/components/vendor-quote/stores-quote-form.tsx)'s exact section
    structure (RFQ Details / Vendor Details / Item Details table / Quotation Summary), reusing its copy
    verbatim (`en.vendorQuote.storesForm`) since the fields mean the same thing here — every field
    renders `disabled` (not `readOnly`, so nothing in an entirely non-interactive card looks
    focusable/editable). A client-computed "Lowest total" `Badge` was tried here initially and then
    removed by product decision — this per-vendor-card layout offers no cross-vendor cue of its own;
    the Award badge (below) is the only per-card indicator now.
  - **Zero new migrations.** `purchase_requisition_rfq_quotations`/`_quotation_items` already grant
    `select to authenticated using (true)` — nothing staff-facing read them before this, but the RLS was
    already in place. `src/lib/data/rfq-quote-comparison.ts`'s `getRfqQuoteComparison()` reads: PR header
    + `vessel_label` from `pr_requisition_list` (the same view `searchPurchaseRequisitions` already
    relies on), `vessel_imo_no` via a plain `vessels` lookup by name (same relationship
    `get_rfq_quote_details_by_token`/`add_vessel()` already establish, just as a TS query instead of
    embedded SQL), quotations scoped by `.eq("requisition_id", …).in("rfq_link_id", linkIds)` (no join to
    the links table needed — the quotations table already denormalizes `requisition_id`), quotation items
    grouped per vendor via a `Map` (same flat-query-plus-Map pattern `getRfqLinksForRequisition`
    established), and line item photos signed with the normal **session-scoped** client (not
    `admin.ts` — staff has a real session, unlike the anonymous-vendor path in `rfq-quote.ts`). The API
    route also clamps `linkIds` server-side to `MAX_COMPARE_SELECTION` (`src/lib/constants/rfq-link.ts`,
    shared with the dialog's own checkbox cap) — defense in depth, since a query string isn't trusted to
    already respect the client's own selection limit.
  - Each vendor's card is fully self-contained (own line-item snapshot from
    `purchase_requisition_rfq_quotation_items`, own order) — no cross-vendor row alignment is needed,
    since this is N independent cards, not a merged table. This also means the read-only card needs none
    of `stores-quote-form.tsx`'s live dynamic-column label-matching (`findColumnValue`): the snapshot
    columns (`requested_description`/`requested_impa_code`/`approved_qty`/`uom`) are read straight off
    each `purchase_requisition_rfq_quotation_items` row.
  - **Graceful degradation for a since-reissued link**: reissuing an already-submitted link
    (previous bullet) hard-deletes the old link and cascades away its quotation, so a `linkId` a staff
    member selected earlier may no longer resolve to a quotation by the time Compare Quote is clicked (or
    the modal reopened later in the same session). `getRfqQuoteComparison()` simply returns fewer
    `vendors` than requested `linkIds` rather than erroring; `CompareQuotesModal` shows an amber
    partial-selection notice if some are missing, or a full empty state if none resolved — never a crash.
  - Scope is view-only for this pass, per an explicit decision when asked: no "award/choose vendor →
    create Purchase Order" action yet (that's a separate, larger, not-yet-planned feature) — matches the
    already-established "nothing happens yet" state of the Compare CTA before this change.
- **`issue_rfq_link` requires every line item's Approved Qty to be filled before an RFQ can be issued**
  (`20260913030000_require_approved_qty_before_issue_rfq.sql`, a new `55002` errcode, mapped to its own
  message in `rfq-links/route.ts`) — an RFQ sent out with a blank Approved Qty can't actually be priced
  against (`submit_rfq_quotation`'s own `total_price` computation already silently returns `null`
  whenever `approved_qty` is missing), so this catches the gap when it's still actionable instead of only
  surfacing it once an incomplete quote comes back. **Skipped entirely for Service PRs** — checked via
  the requisition's own `category` dropdown value (`= 'service'`) — since Service has no Qty concept at
  all (§7's `PR_LINE_ITEM_PRESET_COLUMN`), so there's no Approved Qty column to require in the first
  place; Stores and Spares are both checked. The check is "every line item has a non-empty Approved Qty
  value," which also naturally covers the (shouldn't-happen-but-defensive) case of the column being
  entirely absent from a line item.
- **Requisition No. is its own table column**, no longer stacked as a smaller secondary line under the
  PR ref — in both `pr-table.tsx` (`t.columns.requisitionNumber`) and `rfq-table.tsx`
  (`t.table.columns.requisitionNumber`). Same `row.requisitionNumber` data both tables already had; this
  was a display-only layout change (each cell simply moved into its own `<th>`/`<td>`, `"—"` when null).
- **RFQ vendors modal (`rfq-links-dialog.tsx`) gained three per-vendor summary columns** — Grand Total,
  Delivery Terms (Incoterm), and the maximum Delivery Lead Time across that vendor's own line items —
  `null`/"—" for `PENDING`/`EXPIRED` rows, since there's no quotation to read them from yet.
  `getRfqLinksForRequisition` (`src/lib/data/rfq-links.ts`) gained a third flat query
  (`purchase_requisition_rfq_quotation_items`, `quotation_id`/`delivery_lead_time` only, run only when
  at least one quotation exists) alongside its existing links/quotations pair, joined the same
  flat-query-plus-Map way as everywhere else in this file. The max is computed in JS, not a SQL
  aggregate/RPC — a requisition realistically has a handful of line items — via
  `Number(delivery_lead_time)` + `Number.isFinite` filtering per item before `Math.max`, deliberately
  defensive rather than assuming every stored value is already digits-only: that validation
  (`vendorQuoteItemSchema.deliveryLeadTime`, §17) only applies going forward, so older rows can still
  hold pre-validation free-text values that must be silently skipped, not thrown on or NaN-poison the
  max for that vendor's other, valid line items. The dialog itself widened from `size="lg"` to
  `size="xl"` to fit the 3 new columns alongside its existing 6, matching
  `create-requisition-dialog.tsx`'s own precedent for "wide table needs a wide dialog."
- **Award** — staff pick exactly one vendor's submitted quote as the winner, from either the RFQ
  vendor modal or the Compare Quotes modal. `purchase_requisitions` gained one nullable column,
  `awarded_rfq_link_id` (FK to `purchase_requisition_rfq_links`, no `on delete cascade` — default
  `no action` means Postgres itself refuses to delete a link this column still points to, on top of
  the guard below), and one new RPC, `award_purchase_requisition(p_id, p_rfq_link_id)`
  (`20260913040000_purchase_requisitions_award_column.sql`,
  `20260913050000_award_purchase_requisition_rpc.sql`), mirroring `cancel_purchase_requisition`'s own
  auth/status-guard shape exactly. Only reachable from `quotes_received` (errcode `55000` otherwise —
  this is what makes "only one vendor can ever be awarded" hold, since an already-`awarded` or
  `cancelled` requisition both fail the same check), and only for a link that genuinely has a
  submitted quote for that requisition (`55001` otherwise). `PR_STATUS.AWARDED` itself, its `moss`
  badge tone, and `pr-table.tsx`'s Cancel/Issue-RFQ disabling for it all **already existed** before
  this feature — this was the one missing piece that could actually reach that state, so the PR list
  page needed zero changes of its own.
  - **`issue_rfq_link`/`reissue_rfq_link` needed no changes at all.** Both already guard on a status
    allow-list that excludes `'awarded'` (raising their own pre-existing `55000`), so both were
    already correctly refused post-award before this feature touched anything — confirmed live
    (awarding a requisition, then calling `reissue_rfq_link` against one of its other links, still
    fails with reissue's own original guard). The only change needed was a **frontend-only** one:
    `rfq-links-dialog.tsx` stops rendering the Reissue button at all once any link
    `isAwarded` (an `anyAwarded` check), purely so the UI never offers a button that would just 409 —
    **Copy is deliberately left unchanged** (already gated to `PENDING` rows only, independent of
    award, and copying a dead link isn't a broken action the way clicking Reissue would be).
  - **`RfqLinkRow` and `QuoteComparisonData` both gained an award flag, not a 4th status value.**
    `RfqLinkRow.isAwarded: boolean` (`src/lib/data/rfq-links.ts`, a third parallel query reading
    `purchase_requisitions.awarded_rfq_link_id`) and `QuoteComparisonData.awardedLinkId: string | null`
    (`src/lib/data/rfq-quote-comparison.ts`, from the same column, already queried by that file).
    `RFQ_LINK_STATUS` itself stays a 3-state enum — an awarded link is always, definitionally, also
    `QUOTE_RECEIVED` underneath, so award is layered on top at render time (the vendor modal's Status
    column shows an "Awarded" badge instead of the normal status badge when `isAwarded`, rather than
    teaching `STATUS_TONE`/`statusLabels` a 4th key) — same "keep derived concepts distinct" reasoning
    `REQUESTED_QUOTE_STATUS` already documents for staying separate from `PR_STATUS`. For that same
    reason, **the Requested Quote list's own progress column/`pr_rfq_progress` view is untouched** —
    awarding doesn't change vendor/quote counts, so `derived_status` is unaffected by design.
  - **One shared confirm dialog + one submit handler for both entry points.** `AwardConfirmDialog`
    (`src/components/rfq/award-confirm-dialog.tsx`, same trivial shape as
    `reissue-warning-dialog.tsx`/`cancel-pr-dialog.tsx`) and its `handleAwardConfirmed` both live in
    `rfq-links-dialog.tsx` alone — the per-row Award button (shown only when a row is
    `QUOTE_RECEIVED` and no vendor is awarded yet) and `CompareQuotesModal`'s own per-card Award
    button both just set the same `awardTarget` state via a passed-down `onAwardClick` prop, so the
    actual POST to `/api/purchase-requisitions/[id]/award` exists exactly once. On success, the
    dialog patches its own local `compareData.awardedLinkId` directly (so an already-open Compare
    modal reflects the award immediately, since that data isn't part of the `onAwarded()` refetch
    below) and calls `onAwarded()` — a new prop on `RfqLinksDialog`, wired the same
    fetch-and-replace-`selectedLinks` way `onReissued`/`handleLinksReissued` already are in
    `requested-quote-view.tsx`.
  - **`Dialog` atom gained one optional prop, `zIndexClassName` (default `"z-30"`, every existing
    call site unaffected).** `CompareQuotesModal` is a bespoke `z-40` `createPortal` (not built on
    this atom, per its own already-documented reasoning), and `AwardConfirmDialog` is the one confirm
    dialog that can be opened *from inside* it — at the atom's default `z-30` it would've rendered
    behind the compare modal instead of on top of it. `AwardConfirmDialog` passes `zIndexClassName="z-50"`
    unconditionally (harmless when opened from the vendor modal instead, where nothing else is above
    `z-30` anyway).
  - Scope: this does **not** create a Purchase Order record — matches the already-documented decision
    (above) that Compare Quotes itself shipped view-only, with "award → create PO" left as a separate,
    not-yet-planned feature. Award here is exactly: pick a winner, lock out further RFQ activity on
    this requisition, flip its status.
  - **Reversed, by later product decision: the Requested Quote list's own status column now DOES show
    "Awarded."** The original reasoning above (`REQUESTED_QUOTE_STATUS`/`pr_rfq_progress` must never
    know about `PR_STATUS`) still holds for `pr_rfq_progress` itself — that view is untouched, stays a
    pure vendor/quote-count concept. The override happens one layer up, in `search_requested_quotes`
    (`20260913060000_search_requested_quotes_awarded_override.sql`, `create or replace function`):
    restructured around a `with matched as (...)` CTE so `case when v.status = 'awarded' then
    'awarded_status' else p.derived_status end` is computed once and reused by both the output column
    and the `p_derived_statuses` filter (a plain inline `case` in the `where` clause would have had to
    repeat the expression, and filtering by "Awarded" wouldn't have matched what the same query's
    `select` labels as awarded). `REQUESTED_QUOTE_STATUS` gained a 4th value, `AWARDED: "awarded_status"`
    (`src/lib/constants/requested-quote.ts`) — deliberately not the bare string `"awarded"`, to avoid
    that value colliding with `PR_STATUS.AWARDED`'s own string despite being a different concept, same
    disambiguation `RFQ_ISSUED: "rfq_issued_status"` already used for the same reason. `rfq-table.tsx`'s
    `STATUS_TONE` maps it to `moss`, matching `PR_STATUS.AWARDED`'s own tone elsewhere in the app.
    Everywhere else that reads `derivedStatus`/builds status filter options (`requested-quotes.ts`,
    `requested-quote-view.tsx`'s `STATUS_OPTIONS`, `api/requested-quotes/route.ts`'s `VALID_STATUSES`)
    already derives from this one constant or casts the RPC's own string output, so all three picked up
    the new value with zero code changes.
  - **Bug fix: reissuing or awarding a vendor from the RFQ vendor modal didn't refresh the Requested
    Quote table row behind it.** `requested-quote-view.tsx`'s old `handleLinksReissued` only refetched
    the already-open dialog's own `selectedLinks` (via `fetchLinksForRow`), never the outer table's
    `fetchList(...)` — harmless for Reissue-of-a-never-submitted-link, but wrong for reissuing an
    already-`QUOTE_RECEIVED` link (deletes its quotation, so `quote_count`/`derived_status` on the
    outer row change too) and wrong for Award once the bullet above made `derived_status` itself
    award-sensitive. Replaced with one `handleLinksChanged`, run via `Promise.all` (`fetchLinksForRow`
    + `fetchList({ page, pageSize, ...appliedParams })`, the same params shape `RfqPager`'s own
    `onPageChange` already uses), passed as both `onReissued` and `onAwarded` to `RfqLinksDialog` —
    both actions need the identical two-part refresh, so there's no reason for two near-duplicate
    handlers.

## 19. Keeping this file current

This file is auto-loaded into every session via `CLAUDE.md`'s `@plans/development.md` import — it's
only useful if it matches what the code actually does. Update the relevant section **in the same
change**, not as a follow-up, whenever:

- A new environment variable is added — update §13 and `.env.example` together.
- A new auth/session pattern or Supabase client usage is introduced or changed — update §11 (and
  §12 if it changes how routes authenticate).
- A new enum-like value set appears (another `role`/`status`-shaped field, another set of route
  paths) — give it the same treatment as §7's `USER_ROLE`/`PROFILE_STATUS`/`ROUTES`, don't let raw
  string literals creep back in.
- A new API convention, component-organization rule, or any other repeated pattern is introduced —
  add or revise the relevant numbered section rather than leaving it undocumented.
- An existing convention changes — edit the section in place; don't leave the old and new
  descriptions both in the file.
