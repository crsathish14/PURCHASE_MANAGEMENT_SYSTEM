import type { Metadata } from "next";

import en from "@/locales/en.json";
import { getVessels } from "@/lib/data/vessels";
import { requireAdmin } from "@/lib/supabase/require-active-user";
import { VesselsView } from "@/components/vessels/vessels-view";

const t = en.staff.vessels;

export const metadata: Metadata = {
  title: `${t.title} — ${en.auth.brand.word}`,
};

export default async function VesselsPage() {
  // Admin-only, same as team-access/page.tsx — both are Settings-area pages
  // sharing the SettingsSubnav. See the comment on requireActiveUser() for
  // why this re-check is needed even though (staff)/layout.tsx already does one.
  await requireAdmin();
  const vessels = await getVessels();

  return <VesselsView initialVessels={vessels} />;
}
