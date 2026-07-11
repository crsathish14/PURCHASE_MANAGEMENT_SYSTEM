alter table public.profiles enable row level security;

-- security definer + owned by the table owner, so it bypasses RLS internally
-- and avoids infinite recursion when policies below query this same table.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "profiles_select_admin_all"
on public.profiles for select
to authenticated
using (public.is_admin());

-- No insert/update/delete policies: inserts happen only via the
-- security-definer handle_new_user() trigger; role/status changes are
-- Studio-only until an admin approve/deny UI exists.
