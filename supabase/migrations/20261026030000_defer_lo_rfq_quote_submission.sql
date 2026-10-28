-- Stage 2 exposes LO RFQ links and their read-only detail preview. Keep the
-- anonymous quotation RPC from accepting a Stores-shaped payload for LO
-- until the category-specific quote form and persistence are implemented.
create function public.reject_lo_rfq_quote_before_form()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text;
begin
  select dv.option_value into v_category
  from public.purchase_requisition_dropdown_values dv
  join public.pr_dropdown_fields f on f.id = dv.field_id and f.key = 'category'
  where dv.requisition_id = new.requisition_id;

  if v_category = 'lo' then
    raise exception 'LO quote submission is not available yet' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.reject_lo_rfq_quote_before_form() from public, anon, authenticated;

create trigger reject_lo_rfq_quote_before_form
before insert on public.purchase_requisition_rfq_quotations
for each row execute function public.reject_lo_rfq_quote_before_form();
