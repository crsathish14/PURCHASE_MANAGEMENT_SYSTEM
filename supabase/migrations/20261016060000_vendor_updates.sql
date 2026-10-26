-- Vendor details can be updated only by admins through the protected API.
create policy "vendors_update_admin"
on public.vendors for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
