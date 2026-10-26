import Link from "next/link";

import en from "@/locales/en.json";
import { ROUTES } from "@/lib/routes";

const t = en.staff.settingsSubnav;

const ACTIVE_CLASSES =
  "rounded-md border border-line bg-paper px-3 py-2 text-[13px] font-bold whitespace-nowrap text-ink shadow-(--shadow-e1)";
const INACTIVE_CLASSES =
  "rounded-md px-3 py-2 text-[13px] font-bold whitespace-nowrap text-slate hover:text-ink";

// Shared by the pages in the Settings area.
export function SettingsSubnav({ active }: { active: "team" | "vessels" | "vendors" }) {
  return (
    <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
      <Link
        href={ROUTES.TEAM_ACCESS}
        className={active === "team" ? ACTIVE_CLASSES : INACTIVE_CLASSES}
      >
        {t.team}
      </Link>
      <Link href={ROUTES.VESSELS} className={active === "vessels" ? ACTIVE_CLASSES : INACTIVE_CLASSES}>
        {t.vessels}
      </Link>
      <Link href={ROUTES.VENDORS} className={active === "vendors" ? ACTIVE_CLASSES : INACTIVE_CLASSES}>
        {t.vendors}
      </Link>
    </nav>
  );
}
