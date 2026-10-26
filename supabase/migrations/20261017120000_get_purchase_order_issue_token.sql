-- Staff can retrieve the permanent link for an issued requisition without
-- exposing access_token through direct table reads.
create or replace function public.get_purchase_order_issue_token(p_requisition_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_access_token text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid and p.status = 'active') then
    raise exception 'Account is not active' using errcode = '28000';
  end if;

  select i.access_token into v_access_token
  from public.purchase_order_issuances i
  where i.requisition_id = p_requisition_id;

  return v_access_token;
end;
$$;

revoke all on function public.get_purchase_order_issue_token(uuid) from public, anon;
grant execute on function public.get_purchase_order_issue_token(uuid) to authenticated;
