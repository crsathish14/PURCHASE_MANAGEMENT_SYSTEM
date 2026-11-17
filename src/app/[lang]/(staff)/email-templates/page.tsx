import type { Metadata } from "next";

import en from "@/locales/en.json";
import { getEmailTemplates } from "@/lib/data/email-templates";
import { requireAdmin } from "@/lib/supabase/require-active-user";
import { EmailTemplatesView } from "@/components/email-templates/email-templates-view";

const t = en.staff.emailTemplates;

export const metadata: Metadata = {
  title: `${t.title} — ${en.auth.brand.word}`,
};

export default async function EmailTemplatesPage() {
  // Admin-only, same as vessels/page.tsx — a Settings-area page sharing the SettingsSubnav.
  await requireAdmin();
  const templates = await getEmailTemplates();

  return <EmailTemplatesView initialTemplates={templates} />;
}
