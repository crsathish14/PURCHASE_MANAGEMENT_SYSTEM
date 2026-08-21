import {
  BarChart3,
  Building2,
  ClipboardList,
  type LucideIcon,
  Kanban,
  LayoutDashboard,
  PackageCheck,
  Receipt,
  Send,
  Settings,
  Ship,
  ShoppingCart,
} from "lucide-react";

import en from "@/locales/en.json";

const nav = en.staff.nav;

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

// Mirrors Design-docs/app/dashboard.html's sidebar exactly: same 11 items,
// same order, same two groups split by a divider before Reports. Routes
// other than /en/dashboard don't exist yet — they resolve to the existing
// [lang]/not-found.tsx page until each module gets built.
export const NAV_ITEMS: NavItem[] = [
  { label: nav.dashboard, href: "/en/dashboard", icon: LayoutDashboard },
  { label: nav.pipeline, href: "/en/pipeline", icon: Kanban },
  { label: nav.poRequests, href: "/en/po-requests", icon: ClipboardList },
  { label: nav.rfq, href: "/en/rfq-list", icon: Send },
  { label: nav.purchaseOrders, href: "/en/purchase-orders", icon: ShoppingCart },
  { label: nav.invoiceLog, href: "/en/invoice-log", icon: Receipt },
  { label: nav.deliveryNotes, href: "/en/delivery-notes", icon: PackageCheck },
  { label: nav.vendors, href: "/en/vendors", icon: Building2 },
  { label: nav.vessels, href: "/en/vessels", icon: Ship },
];

export const NAV_ITEMS_SECONDARY: NavItem[] = [
  { label: nav.reports, href: "/en/reports", icon: BarChart3 },
  { label: nav.settings, href: "/en/team-access", icon: Settings },
];
