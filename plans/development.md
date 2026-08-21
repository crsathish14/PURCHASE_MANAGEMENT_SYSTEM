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
  nav-items), `team-access/` (the Team & Access page's view/table/invite-dialog).
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

Two files hold every value that would otherwise be a magic string:

- `src/lib/constants/profile.ts` — `USER_ROLE` (`ADMIN`/`OFFICER`) and `PROFILE_STATUS`
  (`PENDING`/`ACTIVE`/`DISABLED`). **Never** compare `profiles.role`/`profiles.status` against a raw
  `"admin"`/`"active"`/etc. string literal, and never use one as a Zod enum value, a `<select>`
  option value, or a default form value — import the constant instead. `UserRole`/`ProfileStatus`
  types in `src/lib/types/database.ts` are derived from this file, not redeclared.
- `src/lib/routes.ts` — `ROUTES`, every locale-prefixed path the app links to or redirects to (see
  §3).

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
  job (creating an invited user via `auth.admin.createUser`, clearing a profile's own
  `must_change_password` flag — see the migration comment on why no self-update RLS policy exists).
  Don't reach for it as a shortcut around RLS elsewhere.
- Schema lives in `supabase/migrations/*.sql` — `profiles` table (`admin`/`officer` roles,
  `pending`/`active`/`disabled` status, `must_change_password` flag), RLS (select-own + admin-all,
  admin-update, no client-side self-update/insert/delete), a `storage.attachments` bucket policy.
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
