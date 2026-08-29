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
  (`APPROVED_QTY`/`REMARKS`/`ROB` — apply to both Stores and Spares; `PART_NO` — Spares only;
  `IMPA_CODE`/`UOM` — Stores only, Spares has no UOM column — the stable keys `LineItemsField` uses
  for its category-driven preset line-item columns, kept distinct from a genuinely user-added custom
  column's random `crypto.randomUUID()` key). The category → preset-column-set mapping itself lives
  in one place, `getPresetColumnsForCategory()` in `src/lib/purchase-requisition/preset-columns.ts`
  — both `LineItemsField` (manual create/edit) and the import-template parser (§16) import it, so
  they can't drift apart. `APPROVED_QTY` is office-only (filled in during review, never sourced from
  the import template) but is still part of this set, since the column must exist either way.
- `src/lib/routes.ts` — `ROUTES`, every locale-prefixed path the app links to or redirects to (see
  §3).
- `src/lib/constants/storage.ts` — `STORAGE_BUCKET` (currently just `ATTACHMENTS`), `MAX_PHOTO_SIZE_BYTES`,
  `MAX_PHOTOS_PER_LINE_ITEM`, `MAX_PHOTO_DIMENSION_PX`, `PHOTO_JPEG_QUALITY`, `ALLOWED_PHOTO_MIME_TYPES`,
  `PHOTO_EXTENSION_BY_MIME_TYPE`, `PR_LINE_ITEM_PHOTO_PATH_PREFIX`, `SIGNED_DISPLAY_URL_TTL_SECONDS` — the
  shared vocabulary every Storage-backed upload feature uses. `MAX_PHOTO_SIZE_BYTES`/`ALLOWED_PHOTO_MIME_TYPES`
  mirror the `attachments` bucket's own `file_size_limit`/`allowed_mime_types` settings for fast
  client-side pre-validation only; the bucket settings themselves (not this file) are the real
  enforcement boundary, since a signed-upload-URL flow means file bytes never pass through our server.
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

## 16. Spreadsheet import (generate + parse a `.xlsx` template)

The Create Requisition "Import Excel" menu (`po-requests-view.tsx`) is the first feature to
generate and parse spreadsheets — `exceljs` is the one dependency for both directions (its
`package.json` `browser`/`main` fields resolve to the right build automatically for a client
component vs. a Route Handler; no separate library needed per side).

- **Generate**: `GET src/app/api/purchase-requisitions/import-template/route.ts?category=stores|spares`
  builds the workbook server-side from live data (`getPrDropdownFields()` for Vessel/Department
  dropdown-validated cells), so the template can never go stale the way a static checked-in file
  would. Returned with `Content-Disposition: attachment` — a plain `<a href>` download link, no
  client-side blob handling needed.
- **Marker convention**: every generated template carries a hidden `veryHidden` sheet
  (`_pms_meta`, cell `A1` = `pms-pr-template:<category>:v1`) so the parser can confirm a file really
  is one of these templates (not an unrelated spreadsheet) and recover which category it was
  generated for, without relying on the visible sheet layout at all.
- **Parse**: `src/lib/purchase-requisition/import-template.ts` (client-side, called from
  `po-requests-view.tsx`'s upload handler) reads the workbook via `exceljs`'s browser build, matches
  header fields by **label text**, not fixed cell refs (scans every cell, pairs each known label
  with whatever's immediately to its right) — the same tolerance-to-drift approach as line-item
  columns, matched by header text so their order in the template isn't load-bearing either.
- Parsed output feeds `CreateRequisitionDialog`'s new `initialImportValues` prop, which seeds the
  normal create form — nothing is written to the DB until the user reviews and Submits through the
  existing POST `/api/purchase-requisitions` path. A future upload-a-file-and-prefill-a-form feature
  should follow this same shape (generate from live data + hidden marker + label-matched parse into
  existing form state) rather than inventing a new one.
- **Not every preset column is importable.** The parser always sets `columns` to the category's full
  `getPresetColumnsForCategory()` set (§7), not just whatever headers the file had — so a column like
  Approved Qty that the template deliberately omits (office-only, filled in during review) still
  exists after import, just blank. A future column that's manual-only the same way should follow that
  pattern: keep it out of the generator's `lineItemHeaders` list, and don't add it to
  `LINE_ITEM_COLUMN_KEY_BY_LABEL` — no other change is needed for it to still show up post-import.
- **ExcelJS gotcha**: a `dataValidation` of `type: "list"` cannot reference a range on another sheet
  directly (e.g. `formulae: ["Lists!$A$2:$A$4"]`) — Excel's own UI can't author that either, and a
  file with one throws "repaired/removed unreadable content" on open. Cross-sheet list sources must
  go through a workbook-level defined name instead (`workbook.definedNames.add(rangeRef, name)`, then
  `formulae: [name]`) — see `addListValidation()` in the generate route. Also skip validation entirely
  for an empty option list (an empty list makes `$A$2:$A$1`, an inverted/invalid range — the same
  failure mode) rather than adding it and hoping the range is never actually empty.

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
