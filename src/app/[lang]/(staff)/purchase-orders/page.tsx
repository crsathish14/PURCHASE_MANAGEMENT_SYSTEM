import type { Metadata } from "next";

import { PurchaseOrdersView } from "@/components/purchase-orders/purchase-orders-view";
import en from "@/locales/en.json";
import { DATE_PRESET, type DatePreset } from "@/lib/constants/purchase-requisition";
import { PURCHASE_ORDER_STATUS, type PurchaseOrderStatus } from "@/lib/constants/purchase-order";
import { getPrDropdownFields } from "@/lib/data/purchase-requisition";
import { getPurchaseOrders } from "@/lib/data/purchase-orders";
import { requireActiveUser } from "@/lib/supabase/require-active-user";

const t = en.staff.purchaseOrders;
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const VALID_DATE_PRESETS = new Set<string>(Object.values(DATE_PRESET));
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_PO_STATUSES = new Set<string>(Object.values(PURCHASE_ORDER_STATUS));

export const metadata: Metadata = {
  title: `${t.title} — ${en.auth.brand.word}`,
};

type SP = Record<string, string | string[] | undefined>;
function getStr(p: SP, key: string): string {
  const v = p[key];
  return typeof v === "string" ? v.trim() : "";
}
function getCsv(p: SP, key: string): string[] {
  const v = getStr(p, key);
  return v ? v.split(",").map((x) => x.trim()).filter(Boolean) : [];
}
function parseDateFilter(p: SP): { datePreset?: DatePreset; startDate?: string; endDate?: string } {
  const preset = getStr(p, "datePreset");
  if (!preset || !VALID_DATE_PRESETS.has(preset)) return {};
  const datePreset = preset as DatePreset;
  if (datePreset !== DATE_PRESET.CUSTOM) return { datePreset };
  const df = getStr(p, "dateFrom");
  const dt = getStr(p, "dateTo");
  if (!df || !dt || !ISO_DATE_RE.test(df) || !ISO_DATE_RE.test(dt)) return {};
  const today = new Date().toISOString().slice(0, 10);
  const endDate = dt > today ? today : dt;
  if (df > endDate) return {};
  return { datePreset, startDate: df, endDate };
}

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireActiveUser();
  const sp = await searchParams;

  const rawPage = Number(getStr(sp, "page"));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  const rawPageSize = Number(getStr(sp, "pageSize"));
  const pageSize = PAGE_SIZE_OPTIONS.includes(rawPageSize) ? rawPageSize : DEFAULT_PAGE_SIZE;
  const search = getStr(sp, "q");
  const statuses = getCsv(sp, "status").filter((s): s is PurchaseOrderStatus => VALID_PO_STATUSES.has(s));
  const vessels = getCsv(sp, "vessel");
  const categories = getCsv(sp, "category");
  const { datePreset, startDate, endDate } = parseDateFilter(sp);

  const initialFilters = {
    page,
    pageSize,
    search,
    statuses,
    vessels,
    categories,
    datePreset: datePreset ?? null,
    startDate: startDate ?? null,
    endDate: endDate ?? null,
  };

  const [dropdownFields, { rows, total }] = await Promise.all([
    getPrDropdownFields(),
    getPurchaseOrders({
      page,
      pageSize,
      search: search || undefined,
      statuses: statuses.length ? statuses : undefined,
      vessels: vessels.length ? vessels : undefined,
      categories: categories.length ? categories : undefined,
      datePreset,
      startDate,
      endDate,
    }),
  ]);

  return (
    <PurchaseOrdersView
      initialDropdownFields={dropdownFields}
      initialRows={rows}
      initialTotal={total}
      initialFilters={initialFilters}
    />
  );
}
