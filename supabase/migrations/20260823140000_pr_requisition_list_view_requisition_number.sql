-- Appends requisition_number to pr_requisition_list for the list page's Ref
-- cell and the search RPC. CREATE OR REPLACE VIEW only allows appending
-- columns, never reordering/removing existing ones, so the first 13 columns
-- below are byte-for-byte unchanged from 20260822120000.
create or replace view public.pr_requisition_list as
select
  pr.id,
  pr.pr_number,
  pr.priority,
  pr.status,
  pr.created_at,
  vessel_opt.label as vessel_label,
  dept_opt.label as department_label,
  category_opt.label as category_label,
  (select count(*) from public.purchase_requisition_line_items li
    where li.requisition_id = pr.id) as item_count,
  requester.full_name as requester_name,
  pr.remarks,
  vessel_dv.option_value as vessel_value,
  category_dv.option_value as category_value,
  pr.requisition_number
from public.purchase_requisitions pr
left join public.pr_dropdown_fields vessel_field on vessel_field.key = 'vessel'
left join public.purchase_requisition_dropdown_values vessel_dv
  on vessel_dv.requisition_id = pr.id and vessel_dv.field_id = vessel_field.id
left join public.pr_dropdown_field_options vessel_opt
  on vessel_opt.field_id = vessel_dv.field_id and vessel_opt.value = vessel_dv.option_value
left join public.pr_dropdown_fields dept_field on dept_field.key = 'department'
left join public.purchase_requisition_dropdown_values dept_dv
  on dept_dv.requisition_id = pr.id and dept_dv.field_id = dept_field.id
left join public.pr_dropdown_field_options dept_opt
  on dept_opt.field_id = dept_dv.field_id and dept_opt.value = dept_dv.option_value
left join public.pr_dropdown_fields category_field on category_field.key = 'category'
left join public.purchase_requisition_dropdown_values category_dv
  on category_dv.requisition_id = pr.id and category_dv.field_id = category_field.id
left join public.pr_dropdown_field_options category_opt
  on category_opt.field_id = category_dv.field_id and category_opt.value = category_dv.option_value
left join public.profiles requester on requester.id = pr.created_by;
