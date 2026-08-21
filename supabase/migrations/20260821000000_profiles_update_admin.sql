-- Enables the admin approve/deny UI at /en/team-access: admins can now
-- update any profile's role/status (the API route in src/app/api/team/[id]
-- constrains which fields/transitions are actually allowed).
create policy "profiles_update_admin"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
