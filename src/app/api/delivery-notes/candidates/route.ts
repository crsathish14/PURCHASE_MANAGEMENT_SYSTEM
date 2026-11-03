import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { DELIVERY_NOTE_CANDIDATE_SORT, isDeliveryNoteUrgency } from "@/lib/constants/delivery-note";
import { getDeliveryNoteCandidates } from "@/lib/data/delivery-notes";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 10;
const t = en.staff.deliveryNotes.addDialog;

// Requisitions that are ready for a delivery note but don't have one yet.
// Query: page, pageSize, search, urgency (CSV of danger|warning|normal — none
// means all), sort (default|urgency). Unknown values are ignored, not rejected.
export async function GET(request: Request) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const requestedPage = Number(searchParams.get("page"));
  const requestedPageSize = Number(searchParams.get("pageSize"));

  const page = Number.isInteger(requestedPage) && requestedPage >= 1 ? requestedPage : 1;
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize) ? requestedPageSize : DEFAULT_PAGE_SIZE;
  const search = searchParams.get("search")?.trim() || undefined;
  const urgencies = (searchParams.get("urgency") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(isDeliveryNoteUrgency);
  const sort =
    searchParams.get("sort") === DELIVERY_NOTE_CANDIDATE_SORT.URGENCY
      ? DELIVERY_NOTE_CANDIDATE_SORT.URGENCY
      : DELIVERY_NOTE_CANDIDATE_SORT.DEFAULT;

  try {
    const { rows, total } = await getDeliveryNoteCandidates({ page, pageSize, search, urgencies, sort });
    return NextResponse.json({ data: rows, meta: { page, pageSize, total } });
  } catch (error) {
    console.error("[api/delivery-notes/candidates:GET]", error);
    return NextResponse.json({ error: { message: t.loadError } }, { status: 500 });
  }
}
