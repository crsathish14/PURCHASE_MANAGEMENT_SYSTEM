-- Permanent, non-recoverable delete: no soft-delete flag and no audit-trail
-- row is kept, by explicit product requirement. Every child/grandchild PR
-- table already has ON DELETE CASCADE back to purchase_requisitions.id
-- (20260822030000_purchase_requisitions_schema.sql), so deleting the parent
-- row alone is sufficient — no per-table cleanup here, unlike
-- update_purchase_requisition's explicit delete+reinsert of children, which
-- exists to *replace* their contents during an edit, not to guarantee
-- cleanup on removal.
--
-- Only allowed while status = 'pending_rfq'. Reuses the shared 55000
-- "wrong status for this mutation" convention already used by
-- cancel_purchase_requisition and update_purchase_requisition.
create or replace function public.delete_purchase_requisition(p_id uuid)
returns table (id uuid)
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
  if v_status <> 'pending_rfq' then
    raise exception 'Only requisitions pending RFQ can be deleted' using errcode = '55000';
  end if;

  delete from public.purchase_requisitions where purchase_requisitions.id = p_id;

  return query select p_id;
end;
$$;

revoke all on function public.delete_purchase_requisition(uuid) from public;
grant execute on function public.delete_purchase_requisition(uuid) to authenticated;
