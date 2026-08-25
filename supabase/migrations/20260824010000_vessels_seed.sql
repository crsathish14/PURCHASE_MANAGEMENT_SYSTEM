-- Migrates the 3 vessels that already existed as pr_dropdown_field_options
-- rows (see 20260822020000_pr_dropdown_fields_seed.sql) into the new vessels
-- table. Real IMO numbers weren't on record at migration time — these are
-- placeholders, to be corrected via Supabase Studio (there's no edit UI for
-- vessels by design).
--
-- No pr_dropdown_field_options insert needed here: those 3 rows already
-- exist from the original seed migration and are left untouched.
insert into public.vessels (name, imo_no) values
  ('MV Aster', '0000001'),
  ('MV Kavya', '0000002'),
  ('MV Orion', '0000003');
