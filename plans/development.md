# Write CONVENTIONS.md — project setup reference for page creation

## Context

The foundation is now built: Next.js 16 scaffold, Supabase plumbing, design tokens with light/dark/system theming, an `atoms/` component library, route-level conventions (loading/error/not-found, toasts), and `/en`-prefixed i18n routing. The user is about to start building actual feature pages (Purchase Requests, RFQ, etc.) and wants a markdown file documenting the core setup so that work follows established conventions instead of drifting or re-deriving patterns from scratch each time.

This is a documentation task, not a design task — there are no architectural decisions to make, only accurate synthesis of what already exists across this session's work. No Explore/Plan sub-agents needed.

## Approach

Create **`CONVENTIONS.md`** at the repo root and wire it into **`CLAUDE.md`** via Claude Code's `@file` import syntax, alongside the existing `@AGENTS.md` import (the Next-16-breaking-changes warning). This means both documents load automatically as context in every future session on this repo — exactly what "future creation will follow the core setup" requires, not just a doc someone has to remember to open.

`CLAUDE.md` becomes:
```
@AGENTS.md
@CONVENTIONS.md
```

## CONVENTIONS.md content

Organized as a practical reference, not prose — headers + bullets + exact import paths, so it's skimmable while building a page. Sections:

1. **Stack** — Next.js 16 (App Router, Turbopack, TS), Tailwind v4 (CSS-first `@theme`, no `tailwind.config.ts`), Supabase (Auth/Postgres/Storage), Zustand, React Hook Form + Zod, npm.

2. **Next.js 16 gotchas** — pointer to `AGENTS.md`'s warning + the two breaking changes already hit in this repo: `proxy.ts`/`export function proxy` (not `middleware.ts`/`middleware`), and `error.tsx`'s retry prop is `unstable_retry` (not `reset`). Instruction: check `node_modules/next/dist/docs/` before assuming an API from training data.

3. **Routing & i18n** — every real route lives under `src/app/[lang]/`; `src/proxy.ts` redirects any unprefixed path to `/en`; `src/lib/i18n.ts` holds the supported-locales list (`isLocale`, `defaultLocale`) — add a locale by appending here plus a new dictionary; `src/app/global-not-found.tsx` + the `globalNotFound` flag in `next.config.ts` catch genuinely-unmatched URLs (required because the root layout uses a top-level dynamic segment); `[lang]/not-found.tsx` catches explicit `notFound()` calls within a resolved locale.

4. **Design tokens** — `src/app/globals.css`'s `@theme` block is the only source of colors/fonts/radii/shadows; always use the semantic Tailwind classes (`bg-mist`, `text-ink`, `bg-harbor`, `text-rust`, ...), never hardcode hex; dark mode is a `[data-theme="dark"]` override of the same custom properties, so it's automatic — no `dark:` variants needed. Canonical source: `Design-docs/design-spec.html`.

5. **Component library** — `src/components/atoms/` (Button, Badge, Input, Textarea, Select, Label, Checkbox, Avatar, Spinner), imported via the barrel: `import { Button, Badge } from "@/components/atoms"`. Molecules/organisms (Table, Modal, Drawer, Filter bar, Pagination, Stepper, Empty state, Upload dropzone) are **not built yet** — build them from these atoms when a real page needs them, matching `Design-docs/design-spec.html` §05.

6. **Copy/labels** — all UI text lives in `src/locales/en.json`, imported directly (`import en from "@/locales/en.json"`) and namespaced by page/section. No hardcoded strings in JSX. Add a new top-level key per page.

7. **Client state (Zustand)** — `src/store/theme-store.ts` and `src/store/toast-store.ts` are the reference pattern for any new store: plain `create()`, persisted via a custom raw-string `storage` adapter only if the value needs to survive reloads.

8. **Toasts** — call `toast.success(message)` / `toast.error(message)` from `@/store/toast-store` in any client handler; `<Toaster />` is already mounted once in `[lang]/layout.tsx` — never remount it.

9. **Route-level conventions** — `loading.tsx`/`error.tsx`/`not-found.tsx` exist at `[lang]/` as the defaults (reused for every route unless a segment adds its own more specific one); follow their exact patterns (`Spinner size="lg"` for loading, Client Component + `unstable_retry` for error).

10. **Supabase** — `src/lib/supabase/client.ts` (browser) / `server.ts` (async, Server Components & Route Handlers); no service-role/admin client yet — add one only when a real server action needs to bypass RLS. Schema lives in `supabase/migrations/*.sql` (profiles table, `admin`/`officer` roles, `pending`/`active`/`disabled` status, RLS: select-own + admin-all, no client-side insert/update/delete). `src/lib/types/database.ts` is a hand-written stub — replace with `npx supabase gen types typescript --linked` once a project is linked.

11. **Not built yet (blockers to be aware of)** — auth pages + route-gating middleware, the authenticated sidebar/topbar app shell, a data-fetching convention (direct Server Component queries vs. a data-access layer — decide when the first real page needs Supabase data), the Supabase project itself isn't provisioned yet (`.env.local` doesn't exist).

12. **Before calling a page done** — `npm run typecheck && npm run lint && npm run build` must pass; check the actual rendered output in a dev server when practical, not just that it compiles.

13. **Suggested pattern for a new feature page** — short numbered checklist synthesizing 1–12: add copy to `en.json` → build with `atoms/` (+ new molecules under `components/` if a reusable composed pattern emerges) → route under `[lang]/` → wire Supabase reads via `lib/supabase/server.ts` → verify.

## Verification

- `CLAUDE.md` correctly `@`-imports both files (Claude Code's import syntax, one path per line).
- Spot-check every file path and code identifier named in `CONVENTIONS.md` against the actual repo (already confirmed current via `find src -type f` in this session) so the doc doesn't reference anything stale.
- No code changes, so no typecheck/build needed — this is a docs-only change.
