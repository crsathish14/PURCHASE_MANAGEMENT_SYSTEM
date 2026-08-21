"use client";

import Link from "next/link";
import { useState } from "react";

import en from "@/locales/en.json";
import { ROUTES } from "@/lib/routes";
import type { TeamMember } from "@/lib/data/team";

import { InviteDialog } from "./invite-dialog";
import { TeamTable } from "./team-table";

const t = en.staff.teamAccess;

// Owns the member list so the header's Invite dialog (which creates a row)
// and the table (which mutates rows) — two separate client-component
// subtrees under the server-rendered page — can share the same state.
export function TeamAccessView({
  initialMembers,
  currentUserId,
}: {
  initialMembers: TeamMember[];
  currentUserId: string;
}) {
  const [members, setMembers] = useState(initialMembers);

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
        <InviteDialog setMembers={setMembers} />
      </div>

      <div className="grid grid-cols-1 gap-7 md:grid-cols-[184px_1fr]">
        <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
          <Link
            href={ROUTES.TEAM_ACCESS}
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
          <TeamTable members={members} setMembers={setMembers} currentUserId={currentUserId} />
        </div>
      </div>
    </div>
  );
}
