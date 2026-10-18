-- Every Stores and Spares vendor quote must include a Unit Price for each
-- line item. Keep this invariant at the database boundary as the submission
-- RPC is callable by anonymous vendors and can be invoked without the API
-- route's Zod validation.
create or replace function public.require_rfq_quote_unit_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category text;
begin
  select dv.option_value into v_category
  from public.purchase_requisition_rfq_quotations q
  join public.purchase_requisition_dropdown_values dv on dv.requisition_id = q.requisition_id
  join public.pr_dropdown_fields f on f.id = dv.field_id and f.key = 'category'
  where q.id = new.quotation_id;

  if v_category in ('stores', 'spares') and new.unit_price is null then
    raise exception 'Unit Price is required for every Stores and Spares quote line item'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.require_rfq_quote_unit_price() from public;

create trigger require_rfq_quote_unit_price
  before insert on public.purchase_requisition_rfq_quotation_items
  for each row execute function public.require_rfq_quote_unit_price();
