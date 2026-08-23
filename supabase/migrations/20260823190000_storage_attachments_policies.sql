-- The `attachments` bucket already exists (20260711120300_storage_attachments.sql),
-- deliberately policy-less until an upload feature existed. This is that feature.
-- RLS is already enabled on storage.objects by Supabase itself — unlike every
-- public.* table in this repo, no `alter table ... enable row level security`
-- is needed here.
--
-- Trust model matches every purchase_requisition_* table's own
-- select-authenticated-using(true) policy: any active user can read/write any
-- object in this bucket — the real gate is requireApiActiveUser() at the app
-- layer (src/app/api/uploads/sign/route.ts for issuing an upload URL, every
-- /api route for reads/deletes), not a per-row Storage predicate. Scoped to
-- bucket_id = 'attachments' only, so a future bucket doesn't inherit these.
create policy "attachments_insert_authenticated"
on storage.objects for insert to authenticated
with check (bucket_id = 'attachments');

create policy "attachments_select_authenticated"
on storage.objects for select to authenticated
using (bucket_id = 'attachments');

create policy "attachments_delete_authenticated"
on storage.objects for delete to authenticated
using (bucket_id = 'attachments');

-- Authoritative enforcement of the 5 MB / jpg-png-webp-heic limits.
-- src/lib/constants/storage.ts and api/uploads/sign both pre-check the same
-- numbers for fast feedback, but neither can inspect real file bytes — a
-- signed-upload-URL flow means bytes go client -> Storage directly, never
-- through our server — so this is the one check a modified client can't bypass.
update storage.buckets
set file_size_limit = 5242880, -- 5 MB, matches MAX_PHOTO_SIZE_BYTES
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
where id = 'attachments';
