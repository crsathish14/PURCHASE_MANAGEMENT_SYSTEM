# Purchase Management System

Internal purchase management app (vendors, RFQs, purchase orders, invoices, delivery notes) for a
shipping/vessel operation, built on Next.js and Supabase. Auth (login, self-serve request-access
with admin approval, admin-invite, forced password reset), route-gating, and the Team & Access
admin page are built; the procurement features themselves (RFQ, PO, invoices, etc.) are not yet —
see "What's not built yet" below.

## Tech stack

- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4
- Supabase: Postgres + Auth + Storage
- Zustand (toasts, theme), React Hook Form + Zod (all forms)
- Deploys to Vercel

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

### 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), then copy its Project URL, anon key, and
service role key into `.env.local`.

### 2. Link the project and apply migrations

```bash
npx supabase login
npx supabase init
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This applies `supabase/migrations/*.sql`: the `profiles` table (`admin`/`officer` roles,
`pending`/`active`/`disabled` status, `must_change_password` flag), the `handle_new_user()` trigger
that creates a profile for every new `auth.users` row, row-level security policies, and a private
`attachments` storage bucket reserved for future document uploads.

Confirm in the Supabase Studio table editor: `profiles` exists with RLS **on**, and Storage shows a
private `attachments` bucket.

### 3. Google OAuth (optional — not wired into the login form yet)

1. In Google Cloud Console, create an OAuth consent screen and a Web OAuth Client ID. Set the
   authorized redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback`.
2. In the Supabase Dashboard, go to Authentication → Providers → Google and paste the client
   ID/secret.

The login form (`src/components/auth/login-form.tsx`) currently only does email/password sign-in —
this is prep for later, not required for local dev.

### 4. Create a test / first admin user

Two ways to get an active admin:

- **Self-serve, promoted manually**: sign up at `/en/request-access`, then in the Studio SQL editor:
  ```sql
  update public.profiles
  set role = 'admin', status = 'active'
  where id = '<user-uuid>';
  ```
- **Admin-invite** (once you already have one admin): use the "Invite person" form on
  `/en/team-access` — it creates an active account directly via
  `src/lib/supabase/admin.ts`'s service-role client.

### 5. Regenerate types (optional)

Once linked, replace the hand-written stub with real generated types (re-export
`UserRole`/`ProfileStatus` from `src/lib/constants/profile.ts` afterward — see
`plans/development.md` §7/§11):

```bash
npx supabase gen types typescript --linked > src/lib/types/database.ts
```

## Scripts

- `npm run dev` — start the dev server (Turbopack)
- `npm run build` — production build
- `npm run start` — run a production build
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`

Before calling any change done, `lint`, `typecheck`, and `build` should all pass.

## Deploying

Connect the repo to Vercel and set the four variables from `.env.example`
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SITE_URL`) for each environment.

## CI

`.github/workflows/ci.yml` runs `lint`, `typecheck`, and `build` on every pull request. The build
step needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL`
set as GitHub repository secrets.

## Conventions

See [`plans/development.md`](plans/development.md) for the project's conventions (routing, design
tokens, component library, Supabase setup, constants, API routes, environment variables) and
[`AGENTS.md`](AGENTS.md) for the Next.js version-specific gotchas this repo runs into.

## What's not built yet

No purchase-request/RFQ/PO/delivery/invoice/vendor/vessel features exist yet — only auth, route
gating, and the Team & Access admin page. Storage has no upload UI yet (bucket is configured only).
Google OAuth is configured server-side-ready but not wired into the login form (§3 above).
