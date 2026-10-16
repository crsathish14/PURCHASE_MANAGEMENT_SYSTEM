-- Vendor master data managed from Settings > Vendor.
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pic text not null default '',
  address text not null default '',
  mail text[] not null default '{}',
  contact text[] not null default '{}',
  gst text not null default '',
  created_at timestamptz not null default now()
);

alter table public.vendors enable row level security;

-- The Settings page and its API are admin-only; keep the same restriction at
-- the database boundary for reads and mutations too.
create policy "vendors_select_admin"
on public.vendors for select
to authenticated
using (public.is_admin());

create policy "vendors_insert_admin"
on public.vendors for insert
to authenticated
with check (public.is_admin());

create policy "vendors_delete_admin"
on public.vendors for delete
to authenticated
using (public.is_admin());
