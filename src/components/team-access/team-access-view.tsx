"use client";

import { useState } from "react";

import en from "@/locales/en.json";
import type { TeamMember } from "@/lib/data/team";
import { SettingsSubnav } from "@/components/settings/subnav";

import { MemberDialog } from "./member-dialog";
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
        <MemberDialog mode="invite" setMembers={setMembers} />
      </div>

      <div className="grid grid-cols-1 gap-7 md:grid-cols-[184px_1fr]">
        <SettingsSubnav active="team" />

        <div className="overflow-hidden rounded-xl border border-line bg-paper shadow-(--shadow-e1)">
          <TeamTable members={members} setMembers={setMembers} currentUserId={currentUserId} />
        </div>
      </div>
    </div>
  );
}
