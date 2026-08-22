-- Terminal-state transition: pending_rfq / rfq_issued / quotes_received ->
-- cancelled. Not allowed once a requisition is already awarded or cancelled
-- (errcode 55000, mapped to a 409 at the Route Handler).
create or replace function public.cancel_purchase_requisition(p_id uuid)
returns table (id uuid, status public.pr_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status public.pr_status;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  select purchase_requisitions.status into v_status
  from public.purchase_requisitions
  where purchase_requisitions.id = p_id;

  if v_status is null then
    raise exception 'Requisition not found' using errcode = 'P0002';
  end if;
  if v_status in ('awarded', 'cancelled') then
    raise exception 'This requisition can no longer be cancelled' using errcode = '55000';
  end if;

  update public.purchase_requisitions
  set status = 'cancelled'
  where purchase_requisitions.id = p_id;

  return query select p_id, 'cancelled'::public.pr_status;
end;
$$;

revoke all on function public.cancel_purchase_requisition(uuid) from public;
grant execute on function public.cancel_purchase_requisition(uuid) to authenticated;
