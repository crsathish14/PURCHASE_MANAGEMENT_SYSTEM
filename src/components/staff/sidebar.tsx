"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Anchor } from "lucide-react";

import en from "@/locales/en.json";

import { NAV_ITEMS, NAV_ITEMS_SECONDARY, type NavItem } from "./nav-items";

// Ref: Design-docs/app/dashboard.html (.sidebar, .nav, .brand, .sidebar-foot)
// + design-spec.html §03 Navigation map. Fixed 240px dark rail — same
// reasoning as (auth)/layout.tsx's brand panel and Avatar's gradient: a
// fixed brand surface, not theme-reactive, so colors are hardcoded to match
// the mockup exactly rather than using the semantic light/dark tokens.
export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {isOpen ? (
        <button
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-20 bg-black/40 sm:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex h-screen w-[240px] flex-none flex-col overflow-y-auto bg-[#0B2A4A] text-[#AEBBD4] transition-transform duration-200 sm:sticky sm:top-0 sm:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5 px-5.5 pt-5.5 pb-4">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-md bg-harbor text-white">
            <Anchor size={16} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span className="font-display text-[15px] text-white">{en.auth.brand.word}</span>
        </div>

        <nav className="flex flex-col gap-0.5 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>

        <div className="mx-3 my-2.5 h-px bg-white/10" />

        <nav className="flex flex-col gap-0.5 px-3">
          {NAV_ITEMS_SECONDARY.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>

        <div className="mt-auto border-t border-white/8 px-5.5 py-4.5 text-[11.5px] text-[#7C90B4]">
          {en.staff.footer}
        </div>
      </aside>
    </>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`relative flex h-10 items-center gap-2.5 rounded-[7px] px-3 text-[13px] font-bold transition-colors ${
        active ? "bg-[rgba(30,73,214,.35)] text-white" : "text-[#AEBBD4] hover:bg-[#0F3562] hover:text-white"
      }`}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute top-2 bottom-2 left-[-12px] w-[3px] rounded-full bg-[#5C86F5]"
        />
      ) : null}
      <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
      {item.label}
    </Link>
  );
}
