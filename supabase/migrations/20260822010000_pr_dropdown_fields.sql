-- Generic reference-data tables backing the dynamic dropdown fields on the
-- Create Requisition form. The set of fields (vessel/department/category
-- today) and their options is DB-driven so a new field can be added later
-- via a plain data insert, with zero frontend code changes — see
-- src/lib/data/purchase-requisition.ts.
create table public.pr_dropdown_fields (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.pr_dropdown_field_options (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.pr_dropdown_fields (id) on delete cascade,
  value text not null,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (field_id, value)
);

alter table public.pr_dropdown_fields enable row level security;
alter table public.pr_dropdown_field_options enable row level security;

-- Non-sensitive reference data — any authenticated user (admin or officer)
-- can read it; the real active-user gate is requireActiveUser() at the page
-- level, not RLS.
create policy "pr_dropdown_fields_select_authenticated"
on public.pr_dropdown_fields for select
to authenticated
using (true);

create policy "pr_dropdown_field_options_select_authenticated"
on public.pr_dropdown_field_options for select
to authenticated
using (true);

-- No insert/update/delete policies: this data is maintained via migration
-- seed data / Supabase Studio for now, same as profiles' role/status columns
-- before an admin UI existed for them.
