-- Adds the 5th PR lifecycle status. Kept in its own migration/transaction —
-- Postgres forbids using a freshly added enum value inside the same
-- transaction that added it, so every RPC that references 'cancelled' lives
-- in a later migration file.
alter type public.pr_status add value 'cancelled' after 'awarded';
