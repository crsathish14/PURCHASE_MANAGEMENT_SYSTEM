"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { MoreVertical, Search } from "lucide-react";

import { Avatar, Badge, Button, Input, Menu, MenuItem, Select } from "@/components/atoms";
import type { BadgeTone } from "@/components/atoms";
import { getInitials } from "@/lib/format";
import en from "@/locales/en.json";
import { toast } from "@/store/toast-store";
import type { TeamMember } from "@/lib/data/team";
import type { ProfileStatus, UserRole } from "@/lib/types/database";

const t = en.staff.teamAccess;

const STATUS_TONE: Record<ProfileStatus, BadgeTone> = {
  pending: "amber",
  active: "moss",
  disabled: "rust",
};

export function TeamTable({
  members,
  setMembers,
  currentUserId,
}: {
  members: TeamMember[];
  setMembers: Dispatch<SetStateAction<TeamMember[]>>;
  currentUserId: string;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ProfileStatus>("all");
  const [actingOn, setActingOn] = useState<string | null>(null);

  async function patchMember(
    id: string,
    body: { status: ProfileStatus } | { role: UserRole },
    successMessage: string,
  ) {
    setActingOn(id);
    try {
      const response = await fetch(`/api/team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error?.message ?? t.actionError);
        return;
      }
      setMembers((prev) => prev.map((member) => (member.id === id ? payload.data : member)));
      toast.success(successMessage);
    } catch {
      toast.error(t.actionError);
    } finally {
      setActingOn(null);
    }
  }

  // You first, then other admins, then purchase officers — stable within
  // each group, so the existing created_at-ascending server order holds.
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
      return 0;
    });
  }, [members, currentUserId]);

  const query = search.trim().toLowerCase();
  const filtered = sortedMembers.filter((member) => {
    if (roleFilter !== "all" && member.role !== roleFilter) return false;
    if (statusFilter !== "all" && member.status !== statusFilter) return false;
    if (query) {
      const matchesName = member.fullName?.toLowerCase().includes(query);
      const matchesEmail = member.email?.toLowerCase().includes(query);
      if (!matchesName && !matchesEmail) return false;
    }
    return true;
  });

  const pendingCount = filtered.filter((member) => member.status === "pending").length;
  const disabledCount = filtered.filter((member) => member.status === "disabled").length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <div className="relative min-w-[180px] max-w-[280px] flex-1">
          <Search
            size={13}
            strokeWidth={1.7}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-lt"
          />
          <Input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchPlaceholder}
            className="pl-8"
          />
        </div>

        <Select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value as "all" | UserRole)}
          className="max-w-[170px]"
          aria-label={t.columns.role}
        >
          <option value="all">{t.roleFilter.all}</option>
          <option value="admin">{t.roleFilter.admin}</option>
          <option value="officer">{t.roleFilter.officer}</option>
        </Select>

        <Select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "all" | ProfileStatus)}
          className="max-w-[170px]"
          aria-label={t.columns.status}
        >
          <option value="all">{t.statusFilter.all}</option>
          <option value="pending">{t.statusFilter.pending}</option>
          <option value="active">{t.statusFilter.active}</option>
          <option value="disabled">{t.statusFilter.disabled}</option>
        </Select>
      </div>

      <div className="border-b border-line bg-mist/40 px-5 py-3 text-[12.5px] text-slate">
        <b className="text-ink">{filtered.length}</b> {t.summary.people}
        <span className="mx-1.5">·</span>
        <b className="text-ink">{pendingCount}</b> {t.summary.pendingApproval}
        <span className="mx-1.5">·</span>
        <b className="text-ink">{disabledCount}</b> {t.summary.suspended}
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border-b border-line px-5 py-2.5 text-left font-mono text-[10px] font-bold tracking-wide text-slate-lt uppercase">
              {t.columns.name}
            </th>
            <th className="border-b border-line px-5 py-2.5 text-left font-mono text-[10px] font-bold tracking-wide text-slate-lt uppercase">
              {t.columns.role}
            </th>
            <th className="border-b border-line px-5 py-2.5 text-left font-mono text-[10px] font-bold tracking-wide text-slate-lt uppercase">
              {t.columns.status}
            </th>
            <th className="border-b border-line px-5 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-lt">
                {t.empty}
              </td>
            </tr>
          ) : (
            filtered.map((member) => (
              <tr key={member.id} className="group">
                <td className="border-b border-line px-5 py-3 group-hover:bg-mist/40">
                  <div className="flex items-center gap-2.5">
                    <Avatar initials={getInitials(member.fullName)} size="md" />
                    <div>
                      <div className="flex items-center gap-1.5 text-[13.3px] font-bold text-ink">
                        {member.fullName ?? "—"}
                        {member.id === currentUserId ? (
                          <span className="rounded bg-harbor-50 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-harbor">
                            {t.you}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11.5px] text-slate-lt">{member.email ?? "—"}</div>
                    </div>
                  </div>
                </td>
                <td className="border-b border-line px-5 py-3 text-[13.3px] text-ink group-hover:bg-mist/40">
                  {en.staff.roleLabels[member.role]}
                </td>
                <td className="border-b border-line px-5 py-3 group-hover:bg-mist/40">
                  <Badge tone={STATUS_TONE[member.status]}>{t.statusLabels[member.status]}</Badge>
                </td>
                <td className="border-b border-line px-5 py-3 text-right group-hover:bg-mist/40">
                  {member.status === "pending" ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        title={t.reject}
                        loading={actingOn === member.id}
                        disabled={actingOn === member.id}
                        onClick={() => patchMember(member.id, { status: "disabled" }, t.rejectSuccess)}
                      >
                        {t.reject}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        title={t.approve}
                        className="bg-moss"
                        loading={actingOn === member.id}
                        disabled={actingOn === member.id}
                        onClick={() => patchMember(member.id, { status: "active" }, t.approveSuccess)}
                      >
                        {t.approve}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <Menu
                        trigger={
                          <Button
                            variant="icon"
                            size="sm"
                            aria-label={t.rowMenu}
                            title={t.rowMenu}
                            disabled={member.id === currentUserId}
                            loading={actingOn === member.id}
                          >
                            <MoreVertical size={16} strokeWidth={1.7} aria-hidden="true" />
                          </Button>
                        }
                      >
                        {member.status === "active" ? (
                          <MenuItem
                            onClick={() => {
                              const nextRole: UserRole = member.role === "admin" ? "officer" : "admin";
                              patchMember(member.id, { role: nextRole }, t.roleUpdateSuccess);
                            }}
                          >
                            {member.role === "admin" ? t.makeOfficer : t.makeAdmin}
                          </MenuItem>
                        ) : null}
                        {member.status === "active" ? (
                          <MenuItem
                            tone="danger"
                            onClick={() => patchMember(member.id, { status: "disabled" }, t.suspendSuccess)}
                          >
                            {t.suspend}
                          </MenuItem>
                        ) : (
                          <MenuItem
                            onClick={() => patchMember(member.id, { status: "active" }, t.activateSuccess)}
                          >
                            {t.activate}
                          </MenuItem>
                        )}
                      </Menu>
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
