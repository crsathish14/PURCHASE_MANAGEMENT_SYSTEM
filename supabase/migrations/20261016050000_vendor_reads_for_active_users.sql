-- Active staff need to use saved vendor details while issuing an RFQ.
-- Keep vendor mutations admin-only, but allow active users to read the list.
drop policy "vendors_select_admin" on public.vendors;

create policy "vendors_select_active_users"
on public.vendors for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status = 'active'
  )
);
