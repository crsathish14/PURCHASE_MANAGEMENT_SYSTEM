import type { Metadata } from "next";

import en from "@/locales/en.json";
import { DATE_PRESET, type DatePreset } from "@/lib/constants/purchase-requisition";
import { REQUESTED_QUOTE_STATUS, type RequestedQuoteStatus } from "@/lib/constants/requested-quote";
import { getPrDropdownFields } from "@/lib/data/purchase-requisition";
import { getRequestedQuotes } from "@/lib/data/requested-quotes";
import { requireActiveUser } from "@/lib/supabase/require-active-user";
import { RequestedQuoteView } from "@/components/rfq/requested-quote-view";

const t = en.staff.requestedQuote;
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const VALID_DATE_PRESETS = new Set<string>(Object.values(DATE_PRESET));
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_RFQ_STATUSES = new Set<string>(Object.values(REQUESTED_QUOTE_STATUS));

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

export default async function RequestedQuotePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Re-verify here even though (staff)/layout.tsx already checks — see the
  // comment on requireActiveUser(): a layout's redirect() doesn't stop this
  // page's own render.
  await requireActiveUser();
  const sp = await searchParams;

  const rawPage = Number(getStr(sp, "page"));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  const rawPageSize = Number(getStr(sp, "pageSize"));
  const pageSize = PAGE_SIZE_OPTIONS.includes(rawPageSize) ? rawPageSize : DEFAULT_PAGE_SIZE;
  const search = getStr(sp, "q");
  const statuses = getCsv(sp, "status").filter((s): s is RequestedQuoteStatus => VALID_RFQ_STATUSES.has(s));
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
    getRequestedQuotes({
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
    <RequestedQuoteView
      initialDropdownFields={dropdownFields}
      initialRows={rows}
      initialTotal={total}
      initialFilters={initialFilters}
    />
  );
}
