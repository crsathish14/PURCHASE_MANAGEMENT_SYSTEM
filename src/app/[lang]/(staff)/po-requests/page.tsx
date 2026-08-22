import type { Metadata } from "next";

import en from "@/locales/en.json";
import { getPrDropdownFields } from "@/lib/data/purchase-requisition";
import { requireActiveUser } from "@/lib/supabase/require-active-user";
import { PoRequestsView } from "@/components/purchase-requisition/po-requests-view";

const t = en.staff.poRequests;

export const metadata: Metadata = {
  title: `${t.title} — ${en.auth.brand.word}`,
};

export default async function PoRequestsPage() {
  // Re-verify here even though (staff)/layout.tsx already checks — see the
  // comment on requireActiveUser(): a layout's redirect() doesn't stop this
  // page's own render. requireActiveUser() (not requireAdmin()) since both
  // admin and Purchase Officer roles can view/create requisitions.
  await requireActiveUser();
  const dropdownFields = await getPrDropdownFields();

  return <PoRequestsView initialDropdownFields={dropdownFields} />;
}
