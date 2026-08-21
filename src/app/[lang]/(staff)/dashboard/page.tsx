import type { Metadata } from "next";

import en from "@/locales/en.json";
import { requireActiveUser } from "@/lib/supabase/require-active-user";

export const metadata: Metadata = {
  title: `${en.staff.dashboard.title} — ${en.auth.brand.word}`,
};

export default async function DashboardPage() {
  // Re-verify here even though (staff)/layout.tsx already checks — a
  // layout's redirect() does not stop this page's own render from
  // executing and its content from being included in the response.
  await requireActiveUser();

  return (
    <div className="rounded-lg border border-line bg-paper p-10 text-center shadow-(--shadow-e1)">
      <h1 className="font-display text-2xl font-semibold text-ink">{en.staff.dashboard.title}</h1>
      <p className="mt-2 text-sm text-slate">{en.staff.dashboard.subtitle}</p>
    </div>
  );
}
