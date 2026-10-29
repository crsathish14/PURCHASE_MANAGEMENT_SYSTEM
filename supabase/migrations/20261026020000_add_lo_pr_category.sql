-- Add LO (Lub Oil) as the fourth purchase requisition category. Its option
-- value follows the lowercase category values used by the existing options.
insert into public.pr_dropdown_field_options (field_id, value, label, sort_order)
select id, 'lo', 'LO', 3
from public.pr_dropdown_fields
where key = 'category'
on conflict (field_id, value) do update
set label = excluded.label,
    sort_order = excluded.sort_order;
