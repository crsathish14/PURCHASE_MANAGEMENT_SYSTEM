"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, Menu, Plus, Search } from "lucide-react";

import { Avatar, Button } from "@/components/atoms";
import en from "@/locales/en.json";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types/database";

const t = en.staff.topbar;

function getInitials(fullName: string | null) {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/);
  const initials = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return initials.toUpperCase();
}

// Ref: Design-docs/app/dashboard.html (.topbar, .search, .icon-btn, .split-btn,
// .avatar-btn). Search and the notification bell are static/inert — no real
// search index or notification data exists yet, this is visual shell only.
export function Topbar({
  onMenuClick,
  fullName,
  role,
}: {
  onMenuClick: () => void;
  fullName: string | null;
  role: UserRole;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/en/login");
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-5 border-b border-line bg-mist/90 px-5 backdrop-blur-sm sm:px-8">
      <Button
        variant="icon"
        aria-label={t.menu}
        onClick={onMenuClick}
        className="sm:hidden"
      >
        <Menu size={18} strokeWidth={1.7} aria-hidden="true" />
      </Button>

      <div className="hidden flex-1 items-center gap-2 rounded-md border border-line bg-paper px-3 py-2 text-[13px] text-slate-lt md:flex">
        <Search size={16} strokeWidth={1.7} aria-hidden="true" />
        <span className="flex-1 truncate">{t.searchPlaceholder}</span>
        <kbd className="rounded border border-line px-1.5 py-0.5 text-[10.5px] text-slate-lt">⌘K</kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="icon" aria-label="Notifications" className="relative">
          <Bell size={18} strokeWidth={1.7} aria-hidden="true" />
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-rust"
          />
        </Button>

        <Button variant="primary" size="sm">
          <Plus size={14} strokeWidth={2} aria-hidden="true" />
          {t.new}
        </Button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-mist"
          >
            <Avatar initials={getInitials(fullName)} />
            <span className="hidden text-left lg:block">
              <b className="block text-xs font-bold text-ink">{fullName ?? "—"}</b>
              <span className="block text-[11px] text-slate-lt">{en.staff.roleLabels[role]}</span>
            </span>
            <ChevronDown size={13} strokeWidth={2} className="text-slate-lt" aria-hidden="true" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-48 rounded-md border border-line bg-paper py-1.5 shadow-(--shadow-e2)">
              <div className="border-b border-line px-3.5 py-2">
                <b className="block text-xs font-bold text-ink">{fullName ?? "—"}</b>
                <span className="block text-[11px] text-slate-lt">{en.staff.roleLabels[role]}</span>
              </div>
              <Link
                href="/en/team-access"
                className="block px-3.5 py-2 text-[13px] text-ink hover:bg-mist"
                onClick={() => setMenuOpen(false)}
              >
                {t.settings}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="block w-full px-3.5 py-2 text-left text-[13px] text-rust hover:bg-mist"
              >
                {t.logout}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
