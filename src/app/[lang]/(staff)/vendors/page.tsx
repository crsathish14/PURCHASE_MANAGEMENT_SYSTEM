import type { Metadata } from "next";

import en from "@/locales/en.json";
import { VendorView } from "@/components/vendors/vendor-view";
import { getVendors } from "@/lib/data/vendors";
import { requireAdmin } from "@/lib/supabase/require-active-user";

const t = en.staff.vendors;

export const metadata: Metadata = {
  title: `${t.title} — ${en.auth.brand.word}`,
};

export default async function VendorsPage() {
  await requireAdmin();
  const vendors = await getVendors();

  return <VendorView initialVendors={vendors} />;
}
