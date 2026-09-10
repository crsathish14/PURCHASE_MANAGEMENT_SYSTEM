-- Seed data for the Create Requisition form's dynamic dropdowns — the same
-- sample values already established in Design-docs/app/po-requests.html's
-- modal mock, kept for continuity between the design and the real data.
insert into public.pr_dropdown_fields (key, label, sort_order) values
  ('vessel', 'Vessel', 0),
  ('department', 'Department', 1),
  ('category', 'Category', 2);

insert into public.pr_dropdown_field_options (field_id, value, label, sort_order)
select f.id, o.value, o.label, o.sort_order
from public.pr_dropdown_fields f
join (
  values
    ('vessel', 'mv-aster', 'MV Aster', 0),
    ('vessel', 'mv-kavya', 'MV Kavya', 1),
    ('vessel', 'mv-orion', 'MV Orion', 2),
    ('department', 'deck', 'Deck', 0),
    ('department', 'engine', 'Engine', 1),
    ('department', 'galley', 'Galley', 2),
    ('department', 'bridge', 'Bridge', 3),
    ('category', 'stores', 'Stores', 0),
    ('category', 'spares', 'Spares', 1),
    ('category', 'safety-equipment', 'Safety equipment', 2),
    ('category', 'provisions', 'Provisions', 3)
) as o(field_key, value, label, sort_order) on o.field_key = f.key;
