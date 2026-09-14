import { NextResponse } from "next/server";

import { DATE_PRESET } from "@/lib/constants/purchase-requisition";
import type { DatePreset } from "@/lib/constants/purchase-requisition";
import { REQUESTED_QUOTE_STATUS } from "@/lib/constants/requested-quote";
import type { RequestedQuoteStatus } from "@/lib/constants/requested-quote";
import { getRequestedQuotes } from "@/lib/data/requested-quotes";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 20;
const VALID_STATUSES = new Set<string>(Object.values(REQUESTED_QUOTE_STATUS));
const VALID_DATE_PRESETS = new Set<string>(Object.values(DATE_PRESET));
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseCsvParam(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

// Coerce-never-fail, same convention as purchase-requisitions/route.ts's own
// parseDateFilter: an unrecognized preset, a malformed/missing custom range,
// or dateFrom > dateTo all just drop the date filter entirely rather than
// erroring the request. dateTo is additionally clamped to today.
function parseDateFilter(searchParams: URLSearchParams): {
  datePreset?: DatePreset;
  startDate?: string;
  endDate?: string;
} {
  const requestedPreset = searchParams.get("datePreset");
  if (!requestedPreset || !VALID_DATE_PRESETS.has(requestedPreset)) return {};
  const datePreset = requestedPreset as DatePreset;

  if (datePreset !== DATE_PRESET.CUSTOM) return { datePreset };

  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  if (!dateFrom || !dateTo || !ISO_DATE_RE.test(dateFrom) || !ISO_DATE_RE.test(dateTo)) return {};

  const today = new Date().toISOString().slice(0, 10);
  const endDate = dateTo > today ? today : dateTo;
  if (dateFrom > endDate) return {};

  return { datePreset, startDate: dateFrom, endDate };
}

export async function GET(request: Request) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const requestedPage = Number(searchParams.get("page"));
  const requestedPageSize = Number(searchParams.get("pageSize"));

  const page = Number.isInteger(requestedPage) && requestedPage >= 1 ? requestedPage : 1;
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize) ? requestedPageSize : DEFAULT_PAGE_SIZE;

  const search = searchParams.get("search")?.trim() || undefined;
  const statuses = parseCsvParam(searchParams.get("status"))?.filter((value): value is RequestedQuoteStatus =>
    VALID_STATUSES.has(value),
  );
  const vessels = parseCsvParam(searchParams.get("vessel"));
  const categories = parseCsvParam(searchParams.get("category"));
  const { datePreset, startDate, endDate } = parseDateFilter(searchParams);

  try {
    const { rows, total } = await getRequestedQuotes({
      page,
      pageSize,
      search,
      statuses,
      vessels,
      categories,
      datePreset,
      startDate,
      endDate,
    });
    return NextResponse.json({ data: rows, meta: { page, pageSize, total } });
  } catch (error) {
    console.error("[api/requested-quotes:GET]", error);
    return NextResponse.json({ error: { message: "Couldn't load requested quotes." } }, { status: 500 });
  }
}
