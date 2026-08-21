-- Backs the forced-password-reset flow for admin-invited accounts: an admin
-- sets an initial password directly (src/app/api/team/route.ts POST), and
-- this flag tells the app to route that person through /en/change-password
-- before they can use anything else. No new RLS policy is added here — see
-- src/app/api/account/change-password/route.ts for why that write goes
-- through the service-role client instead of a self-update policy.
alter table public.profiles
  add column must_change_password boolean not null default false;
