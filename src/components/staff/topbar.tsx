"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu } from "lucide-react";

import { Avatar, Button } from "@/components/atoms";
import en from "@/locales/en.json";
import { getInitials } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types/database";

const t = en.staff.topbar;

// Ref: Design-docs/app/dashboard.html (.topbar, .avatar-btn). The topbar holds
// only the mobile menu toggle and the avatar menu; search, the notification
// bell and the New button were removed as not needed.
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
    router.push(ROUTES.LOGIN);
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

      <div className="ml-auto flex items-center gap-2">
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
                href={ROUTES.TEAM_ACCESS}
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
