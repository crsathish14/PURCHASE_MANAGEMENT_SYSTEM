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
import { ROUTES } from "@/lib/routes";

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
  { label: nav.dashboard, href: ROUTES.DASHBOARD, icon: LayoutDashboard },
  { label: nav.pipeline, href: ROUTES.PIPELINE, icon: Kanban },
  { label: nav.poRequests, href: ROUTES.PO_REQUESTS, icon: ClipboardList },
  { label: nav.rfq, href: ROUTES.RFQ_LIST, icon: Send },
  { label: nav.purchaseOrders, href: ROUTES.PURCHASE_ORDERS, icon: ShoppingCart },
  { label: nav.invoiceLog, href: ROUTES.INVOICE_LOG, icon: Receipt },
  { label: nav.deliveryNotes, href: ROUTES.DELIVERY_NOTES, icon: PackageCheck },
  { label: nav.vendors, href: ROUTES.VENDORS, icon: Building2 },
  { label: nav.vessels, href: ROUTES.VESSELS, icon: Ship },
];

export const NAV_ITEMS_SECONDARY: NavItem[] = [
  { label: nav.reports, href: ROUTES.REPORTS, icon: BarChart3 },
  { label: nav.settings, href: ROUTES.TEAM_ACCESS, icon: Settings },
];
