# Purchase Management System

Foundation for the Vessel PMS procurement app. This repo currently contains
only the project scaffold and Supabase plumbing (database schema, clients,
CI) — no business features and no auth pages yet. See `Design-docs/` for the
UI/UX reference used by future feature work.

## Tech stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase: Postgres + Auth + Storage
- Zustand, React Hook Form, Zod (installed, not yet wired to any page)
- Deploys to Vercel

## Local setup

```bash
npm install
cp .env.local.example .env.local   # fill in the values below
npm run dev
```

### 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), then copy its
Project URL, anon key, and service role key into `.env.local`.

### 2. Link the project and apply migrations

```bash
npx supabase login
npx supabase init
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This applies `supabase/migrations/*.sql`: the `profiles` table (with
`admin`/`officer` roles and `pending`/`active`/`disabled` status), the
`handle_new_user()` trigger that creates a profile for every new
`auth.users` row, row-level security policies, and a private `attachments`
storage bucket reserved for future document uploads.

Confirm in the Supabase Studio table editor: `profiles` exists with RLS
**on**, and Storage shows a private `attachments` bucket.

### 3. Google OAuth (optional until login pages are built)

1. In Google Cloud Console, create an OAuth consent screen and a Web OAuth
   Client ID. Set the authorized redirect URI to
   `https://<project-ref>.supabase.co/auth/v1/callback`.
2. In the Supabase Dashboard, go to Authentication → Providers → Google and
   paste the client ID/secret.

### 4. Create a test / first admin user

Add a user via Supabase Studio's Authentication panel. A matching
`public.profiles` row is created automatically with `status='pending'` and
`role='officer'`. To promote it to an active admin, run in the Studio SQL
editor:

```sql
update public.profiles
set role = 'admin', status = 'active'
where id = '<user-uuid>';
```

### 5. Regenerate types (optional)

Once linked, replace the hand-written stub with real generated types:

```bash
npx supabase gen types typescript --linked > src/lib/types/database.ts
```

## Deploying

Connect the repo to Vercel and set the four variables from
`.env.local.example` (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SITE_URL`) for each environment.

## CI

`.github/workflows/ci.yml` runs `lint`, `typecheck`, and `build` on every
pull request. The build step needs `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` set as GitHub
repository secrets.

## What's not built yet

Auth pages (`/login`, `/signup`, `/pending-approval`), route-gating
middleware, and the admin approve/deny UI are intentionally deferred to a
later round — this repo only has the schema and clients they'll build on.
No purchase-request/RFQ/PO/delivery/invoice/vendor/vessel features exist
yet, and Storage has no upload UI yet (bucket is configured only).
