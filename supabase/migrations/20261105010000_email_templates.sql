-- Editable vendor email templates (RFQ, Proforma Invoice request, Tax Invoice request),
-- managed from Settings > Email Templates. The staff dialogs that issue a vendor link
-- fetch the template, fill its placeholders and show it for a one-off edit; only edits
-- made on the Settings page are saved here.
--
-- Placeholders: [Vessel Name], [Requisition No.], [Title], [Company Name], [Insert Link].
create table public.email_templates (
  key text primary key check (key in ('rfq', 'proforma_invoice', 'tax_invoice')),
  subject text not null check (length(btrim(subject)) > 0),
  body text not null check (length(btrim(body)) > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create trigger set_email_templates_updated_at
before update on public.email_templates
for each row execute function public.set_updated_at();

alter table public.email_templates enable row level security;

-- Every active user needs to read the templates (officers issue links);
-- only admins can change them. No insert/delete: the three rows are fixed.
create policy "email_templates_select_authenticated"
on public.email_templates for select
to authenticated
using (true);

create policy "email_templates_update_admin"
on public.email_templates for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.email_templates (key, subject, body) values
(
  'rfq',
  'Request for Quotation (RFQ) – [Vessel Name] – [Requisition No.] – [Title]',
  $body$Dear Sir/Madam,

Good day!

We kindly request you to submit your best quotation for the items/services required for the subject vessel through the link provided below.

Quotation Submission Link: [Insert Link]

Please ensure that you provide quotations for all requested items listed in the requisitions. If any item is unavailable or an alternative is being offered, kindly specify the details clearly.

We request you to complete and submit your quotation through the provided link at the earliest for our review and approval.

We look forward to your prompt response.

Best regards,
Purchase Department
[Company Name]$body$
),
(
  'proforma_invoice',
  'Request for Proforma Invoice (PI) – [Vessel Name] – [Requisition No.] – [Title]',
  $body$Dear Sir/Madam,

Good day!

With reference to our Purchase order for the subject vessel, kindly provide the Proforma Invoice (PI) for the requested items/services as per the agreed quotation.

Please upload the Proforma Invoice through the link provided below:

Proforma Invoice upload Link: [Insert Link]

Kindly ensure that all details and amounts are accurate and consistent with the agreed quotation before uploading the invoice.

We request you to upload the Proforma Invoice at the earliest for further processing and approval.

Thank you for your cooperation.

Best regards,
Purchase Department
[Company Name]$body$
),
(
  'tax_invoice',
  'Request for Tax Invoice – [Vessel Name] – [Requisition No.] – [Title]',
  $body$Dear Sir/Madam,

Good day!

With reference to the supply of goods/services for the subject vessel, kindly arrange to issue and share the Tax Invoice for the supplied items/services.

Please upload the Tax Invoice through the link provided below:

Tax Invoice upload Link: [Insert Link]

Please share the Tax Invoice along with the relevant supporting documents, such as the delivery Notes or service report, wherever applicable, for our accounting purposes.

Kindly share the invoice & Supporting at the earliest.

Thank you for your cooperation.

Best regards,
Purchase Department
[Company Name]$body$
);
