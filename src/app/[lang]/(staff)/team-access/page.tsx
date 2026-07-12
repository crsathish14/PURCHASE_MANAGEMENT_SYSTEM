import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/atoms";
import en from "@/locales/en.json";
import { getTeamMembers } from "@/lib/data/team";
import { requireAdmin } from "@/lib/supabase/require-active-user";

import { TeamTable } from "./team-table";

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

  return (
    <div>
      <p className="mb-3.5 text-xs text-slate-lt">
        {t.breadcrumbSettings}
        <span className="mx-1.5">›</span>
        <b className="font-semibold text-ink">{t.breadcrumbCurrent}</b>
      </p>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{t.title}</h1>
          <p className="mt-1.5 text-sm text-slate">{t.subtitle}</p>
        </div>
        <Button variant="primary" disabled title={t.invite}>
          <Plus size={15} strokeWidth={2} aria-hidden="true" />
          {t.invite}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-7 md:grid-cols-[184px_1fr]">
        <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
          <Link
            href="/en/team-access"
            className="rounded-md border border-line bg-paper px-3 py-2 text-[13px] font-bold whitespace-nowrap text-ink shadow-(--shadow-e1)"
          >
            {t.subnav.team}
          </Link>
          {[t.subnav.company, t.subnav.vessels, t.subnav.categories, t.subnav.budgets, t.subnav.auditLog].map(
            (label) => (
              <span
                key={label}
                className="cursor-not-allowed rounded-md px-3 py-2 text-[13px] whitespace-nowrap text-slate-lt/60"
              >
                {label}
              </span>
            ),
          )}
        </nav>

        <div className="overflow-hidden rounded-xl border border-line bg-paper shadow-(--shadow-e1)">
          <TeamTable members={members} currentUserId={user.id} />
        </div>
      </div>
    </div>
  );
}
