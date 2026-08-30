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
  Checkbox, Avatar, Spinner, Menu, Dialog, PasswordInput, PasswordStrengthMeter), imported via the
  barrel: `import { Button, Badge } from "@/components/atoms"`.
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
  (`APPROVED_QTY`/`REMARKS`/`ROB`/`UOM` — apply to both Stores and Spares; `PART_NO` — Spares only;
  `IMPA_CODE` — Stores only, Spares has no IMPA/ISSA code equivalent — the stable keys
  `LineItemsField` uses for its category-driven preset line-item columns, kept distinct from a
  genuinely user-added custom column's random `crypto.randomUUID()` key). The category →
  preset-column-set mapping itself lives
  in one place, `getPresetColumnsForCategory()` in `src/lib/purchase-requisition/preset-columns.ts`
  — both `LineItemsField` (manual create/edit) and the import-template parser (§16) import it, so
  they can't drift apart. `APPROVED_QTY` is office-only (filled in during review, never sourced from
  the import template) but is still part of this set, since the column must exist either way.
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

## 16. Spreadsheet import (generate + parse a template — two independent VBA workbooks)

The Create Requisition "Import Excel" menu (`po-requests-view.tsx`) generates and parses
spreadsheets — `exceljs` is the one dependency for both directions (its `package.json`
`browser`/`main` fields resolve to the right build automatically for a client component vs. a
Route Handler; no separate library needed per side). Both categories now ship a real, persisted,
VBA-driven workbook (the actual paper-form workflow) rather than an ExcelJS-generated one:

**Both categories — a persisted, VBA-driven workbook (the real paper-form workflow)**
- `GET src/app/api/purchase-requisitions/import-template/route.ts?category=stores|spares` streams
  a static `.xlsm` straight off disk (`readStoresTemplateBuffer()` / `readSparesTemplateBuffer()` in
  `src/lib/purchase-requisition/templates/index.ts`) — each workbook has a real VBA macro project
  (Add Line Item button, Ctrl+V photo-paste into a "SUPPORTING PHOTOS" table, sheet protection),
  which ExcelJS (or any generic spreadsheet library) cannot safely author, so neither is regenerated
  per request. The two are entirely independent VBA projects (separate constants module, separate
  worksheet name, no shared state) that happen to share the same proven architecture — Spares was
  built second, reusing every fix already learned from Stores. Each binary
  (`templates/requisition-form-{stores,spares}.xlsm`) and its readable VBA source + setup guide
  (`templates/vba-source/{stores,spares}/`) are checked in; a filled sample (`*.sample.xlsm`) is kept
  alongside each as a manual test fixture. Regenerating either file means re-running its own setup
  guide's steps in Excel and replacing the binary.
- Each format is told apart by sheet name — `"Stores Requisition Form"` vs. `"Spares Requisition
  Form"` — both containing a "Vessel Name" label (`parseRequisitionTemplateFile`, the dispatcher in
  `import-template.ts`). The Stores sheet name (and its labels) changed once already between the
  template's first and second real-world revisions — v1 files are no longer recognized at all, since
  the paper form itself was revised and this was a full replacement, not a versioned dual-format
  dispatch.
- **Parsing logic is split by what's actually shared.** Everything generic — merge-aware label→value
  lookup (a label can itself be a multi-column merge, e.g. "IMO No" spans two columns, so its value
  starts one column past the end of the label's own merge, not simply "one cell right"), dynamic
  table-section sizing (`getMergeRowSpan()`, read from actual merges rather than a hardcoded offset —
  the SUPPORTING PHOTOS heading grew from 1 row to 2 between Stores' own revisions, which is exactly
  the kind of change this survives automatically), and photo-anchor extraction (images are matched to
  a line item by joining the SUPPORTING PHOTOS table's embedded-image drawing anchors — never its "N
  photos" counter text, which is not authoritative — against each line item's Sl No., including
  continuation rows once a line item has more than 7 photos; there is no cap on how many are imported
  per line item, by design) — lives once in `import-template-vba-shared.ts`. Each format's own thin
  parser (`import-template-vba.ts` for Stores, `import-template-vba-spares.ts` for Spares) supplies
  only what's genuinely different: its own label text, its own line-item column set, and its own
  output shaping (category, and — Spares only — the Equipment Details fields). Two things neither
  parser hardcodes, because the Stores template has already changed them once:
  - **Table section heights**, per the `getMergeRowSpan()` point above.
  - **The photo slot count** (currently 7, `FALLBACK_SLOT_COLUMNS`/`SLOT_COUNT` in the shared module)
    is discovered by scanning the header for `"Photo N"` labels, with the hardcoded array only as a
    fallback — it was 5 in Stores' first template revision; Spares launched directly with 7.
  - Both templates share one more internal inconsistency worth knowing about if this ever needs
    debugging again: the Sl No. column is labeled `"Sl No."` in the line-items table but `"Sl.No."`
    (no space) in the photo table — matched via a small regex (`isSlNoLabel`), not exact equality.
    Separately, `"SUPPORTING PHOTOS"` (the photo table's own heading) and `"Supporting Photos"` (the
    line-items table's own per-row input-cell column label) normalize to the *same* string — the
    heading is found via a column-A-only search (`findLabelCellInColumn`, mirroring each format's own
    VBA `FindRowByLabel`, which only ever searches `COL_SLNO`) specifically to avoid matching the
    wrong one, since a full-sheet search would hit the (earlier, row-wise) column label first.
- Both templates' "Supply Port" header field maps to the app's `requiredPort`, and their footer's
  "Requisitioned by:" / "Approved by:" fields map to `requisitionedBy`/`captainChiefEngineer` (the DB
  column name predates this label; the paper form's own wording for the second field has already
  changed once, from "Captain / Chief Engineer:" to "Approved by:" — the column was kept as-is since
  it's an internal identifier, only the UI label (`en.json`'s `captainChiefEngineer` key) was updated
  to track the current paper form's wording). Spares' template additionally has an Equipment Details
  section (Name of Equipment/Type/Make/Sr. No./Model/Specifications/Any Other details) with no Stores
  equivalent — mapped straight to the matching `equipment*` form fields, same merge-aware lookup.
- Vessel is matched via the file's **IMO No** (not vessel name), the same way in both formats:
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
- Before both categories moved to a persisted VBA workbook, the download route built a workbook
  live from `getPrDropdownFields()` and marked it with a hidden `veryHidden` `_pms_meta` sheet (cell
  `A1` = `pms-pr-template:<category>:v1`) so the parser could confirm a file really was one of these
  templates. The route no longer generates this format for either category, but
  `parseRequisitionTemplateFile` still checks for the marker sheet first and, if present, hands off
  to `parseLegacyWorkbook` — purely so a file someone already downloaded before this change keeps
  working. Header fields there are matched by **label text**, not fixed cell refs (scans every cell,
  pairs each known label with whatever's immediately to its right — this "immediately right" rule
  assumes an unmerged/single-column label, unlike the VBA formats' merge-aware lookup above).

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

## 17. Keeping this file current

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
