import en from "@/locales/en.json";
import type { EmailTemplateKey } from "@/lib/constants/email-template";
import { fillEmailTemplate } from "@/lib/email-templates";
import { createClient } from "@/lib/supabase/server";

export type EmailTemplate = {
  key: EmailTemplateKey;
  subject: string;
  body: string;
  updatedAt: string;
};

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("key, subject, body, updated_at")
    .order("key", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    key: row.key as EmailTemplateKey,
    subject: row.subject,
    body: row.body,
    updatedAt: row.updated_at,
  }));
}

export async function getEmailTemplate(key: EmailTemplateKey): Promise<EmailTemplate | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("key, subject, body, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    key: data.key as EmailTemplateKey,
    subject: data.subject,
    body: data.body,
    updatedAt: data.updated_at,
  };
}

export type RenderedEmailTemplate = { subject: string; body: string };

// The template with the requisition's vessel/requisition no./title and the company name
// filled in. [Insert Link] is left in place: the link doesn't exist until the vendor link
// is created.
export async function getRenderedEmailTemplate(
  key: EmailTemplateKey,
  requisitionId: string,
): Promise<RenderedEmailTemplate | null> {
  const template = await getEmailTemplate(key);
  if (!template) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pr_requisition_list")
    .select("vessel_label, requisition_number, pr_title")
    .eq("id", requisitionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const context = {
    vesselName: data.vessel_label ?? "",
    requisitionNo: data.requisition_number ?? "",
    title: data.pr_title ?? "",
    companyName: en.common.companyName,
  };

  return {
    subject: fillEmailTemplate(template.subject, context),
    body: fillEmailTemplate(template.body, context),
  };
}
