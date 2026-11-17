import { EMAIL_TEMPLATE_PLACEHOLDER } from "@/lib/constants/email-template";

// Pure helpers (no server imports) so both Route Handlers and client dialogs can use them.

export type EmailTemplateContext = {
  vesselName: string;
  requisitionNo: string;
  title: string;
  companyName: string;
};

function replaceAll(text: string, token: string, value: string): string {
  return text.split(token).join(value);
}

// Fills every placeholder except the link one, which only exists once the vendor link
// has been created (see insertLinkIntoMessage).
export function fillEmailTemplate(text: string, context: EmailTemplateContext): string {
  const P = EMAIL_TEMPLATE_PLACEHOLDER;
  let result = text;
  result = replaceAll(result, P.VESSEL_NAME, context.vesselName);
  result = replaceAll(result, P.REQUISITION_NO, context.requisitionNo);
  result = replaceAll(result, P.TITLE, context.title);
  result = replaceAll(result, P.COMPANY_NAME, context.companyName);
  return result;
}

// Puts the link where the template says [Insert Link]. If a one-off edit removed the
// placeholder, the link is appended at the end instead so the message never ships without it.
export function insertLinkIntoMessage(message: string, link: string): string {
  if (message.includes(EMAIL_TEMPLATE_PLACEHOLDER.LINK)) {
    return replaceAll(message, EMAIL_TEMPLATE_PLACEHOLDER.LINK, link);
  }
  return `${message}\n\n${link}`;
}
