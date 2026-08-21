"use client";

import { useState, type ReactNode } from "react";

import type { UserRole } from "@/lib/types/database";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function StaffShell({
  fullName,
  role,
  children,
}: {
  fullName: string | null;
  role: UserRole;
  children: ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} fullName={fullName} role={role} />
        <main className="flex-1 bg-mist p-8">{children}</main>
      </div>
    </div>
  );
}
