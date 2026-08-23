-- Narrows department to Deck/Engine/Other and category to Service/Stores/Spares,
-- per the real fleet operation's actual values (the original seed's
-- Galley/Bridge/Safety equipment/Provisions were placeholders from initial
-- scaffolding).
--
-- Bridge and Safety equipment have zero references and delete cleanly. But
-- PR-9 (department = Galley) and PR-10 (category = Provisions) are real,
-- still-pending_rfq rows that reference the two options being removed — a
-- direct hard-delete hits purchase_requisition_dropdown_values's composite FK
-- (23503). Since both PRs are still pending_rfq (not yet finalized), they're
-- explicitly reassigned to their closest new equivalent (Galley -> Other,
-- Provisions -> Stores) before the old options are deleted, rather than
-- leaving the dropdowns only partially narrowed.
insert into public.pr_dropdown_field_options (field_id, value, label, sort_order)
select id, 'other', 'Other', 2 from public.pr_dropdown_fields where key = 'department';

-- Shift stores/spares right so the new Service option sorts first, matching
-- the order it's referenced in throughout the app (Service, Stores, Spares).
update public.pr_dropdown_field_options
set sort_order = sort_order + 1
where field_id = (select id from public.pr_dropdown_fields where key = 'category')
  and value in ('stores', 'spares');

insert into public.pr_dropdown_field_options (field_id, value, label, sort_order)
select id, 'service', 'Service', 0 from public.pr_dropdown_fields where key = 'category';

update public.purchase_requisition_dropdown_values
set option_value = 'other'
where field_id = (select id from public.pr_dropdown_fields where key = 'department')
  and option_value = 'galley';

update public.purchase_requisition_dropdown_values
set option_value = 'stores'
where field_id = (select id from public.pr_dropdown_fields where key = 'category')
  and option_value = 'provisions';

delete from public.pr_dropdown_field_options
where field_id = (select id from public.pr_dropdown_fields where key = 'department')
  and value in ('galley', 'bridge');

delete from public.pr_dropdown_field_options
where field_id = (select id from public.pr_dropdown_fields where key = 'category')
  and value in ('safety-equipment', 'provisions');
