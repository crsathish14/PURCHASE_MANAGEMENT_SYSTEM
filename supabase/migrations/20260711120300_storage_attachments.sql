-- Reserved for future document uploads (invoices, delivery notes, quotes).
-- Private bucket, no storage policies yet: default-deny is correct until an
-- upload feature exists (only the service role can read/write for now).
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;
