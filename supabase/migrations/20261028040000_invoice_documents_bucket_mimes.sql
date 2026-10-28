-- Extend the shared attachments bucket to accept office document types needed
-- for vendor invoice supporting documents. Remove the 5 MB size limit so
-- supporting documents have no server-enforced size restriction.
update storage.buckets
set
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ],
  file_size_limit = null
where id = 'attachments';
