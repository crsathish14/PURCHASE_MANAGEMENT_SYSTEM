// Keys of the editable vendor email templates (public.email_templates.key).
export const EMAIL_TEMPLATE_KEY = {
  RFQ: "rfq",
  PROFORMA_INVOICE: "proforma_invoice",
  TAX_INVOICE: "tax_invoice",
} as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEY)[keyof typeof EMAIL_TEMPLATE_KEY];

export const EMAIL_TEMPLATE_KEYS: readonly EmailTemplateKey[] = Object.values(EMAIL_TEMPLATE_KEY);

export function isEmailTemplateKey(value: string): value is EmailTemplateKey {
  return (EMAIL_TEMPLATE_KEYS as readonly string[]).includes(value);
}

// Literal tokens an admin can use in a template's subject/body.
export const EMAIL_TEMPLATE_PLACEHOLDER = {
  VESSEL_NAME: "[Vessel Name]",
  REQUISITION_NO: "[Requisition No.]",
  TITLE: "[Title]",
  COMPANY_NAME: "[Company Name]",
  LINK: "[Insert Link]",
} as const;
