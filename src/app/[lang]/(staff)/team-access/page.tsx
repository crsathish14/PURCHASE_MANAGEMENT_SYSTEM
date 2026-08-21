import type { Metadata } from "next";

import en from "@/locales/en.json";
import { getTeamMembers } from "@/lib/data/team";
import { requireAdmin } from "@/lib/supabase/require-active-user";
import { TeamAccessView } from "@/components/team-access/team-access-view";

const t = en.staff.teamAccess;

export const metadata: Metadata = {
  title: `${t.title} — ${en.auth.brand.word}`,
};

export default async function TeamAccessPage() {
  // Re-verify here even though (staff)/layout.tsx already checks — see the
  // comment on requireActiveUser(): a layout's redirect() doesn't stop this
  // page's own render. requireAdmin() additionally bounces non-admins, since
  // this page (and the /api/team it reads via) is admin-only.
  const { user } = await requireAdmin();
  const members = await getTeamMembers();

  return <TeamAccessView initialMembers={members} currentUserId={user.id} />;
}
