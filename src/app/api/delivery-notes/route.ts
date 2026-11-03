import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import { DATE_PRESET, type DatePreset } from "@/lib/constants/purchase-requisition";
import { DELIVERY_NOTE_PATH_PREFIX, STORAGE_BUCKET } from "@/lib/constants/storage";
import { getDeliveryNotes } from "@/lib/data/delivery-notes";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 20;
const t = en.staff.deliveryNotes;
const VALID_DATE_PRESETS = new Set<string>(Object.values(DATE_PRESET));
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PDF_FILENAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

function parseCsvParam(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

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
  const vessels = parseCsvParam(searchParams.get("vessel"));
  const categories = parseCsvParam(searchParams.get("category"));
  const { datePreset, startDate, endDate } = parseDateFilter(searchParams);

  try {
    const { rows, total } = await getDeliveryNotes({
      page,
      pageSize,
      search,
      vessels,
      categories,
      datePreset,
      startDate,
      endDate,
    });
    return NextResponse.json({ data: rows, meta: { page, pageSize, total } });
  } catch (error) {
    console.error("[api/delivery-notes:GET]", error);
    return NextResponse.json({ error: { message: t.loadError } }, { status: 500 });
  }
}

const registerSchema = z.object({
  requisitionId: z.uuid(),
  storagePath: z.string().min(1).max(1024),
  originalFilename: z.string().trim().min(1).max(500),
});

// Registers a PDF the client already uploaded (api/delivery-notes/sign) as a
// delivery note. Anything that fails after the upload also removes the
// uploaded object so a rejected request never leaves an orphan in Storage.
export async function POST(request: Request) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: t.api.invalidRequest } }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { message: t.api.invalidRequest } }, { status: 400 });
  }
  const { requisitionId, storagePath, originalFilename } = parsed.data;

  // The path must be one this requisition's sign route could have minted:
  // delivery-notes/<requisitionId>/<uuid>.pdf — never a client-chosen location.
  const prefix = `${DELIVERY_NOTE_PATH_PREFIX}/${requisitionId}/`;
  if (!storagePath.startsWith(prefix) || !UUID_PDF_FILENAME_RE.test(storagePath.slice(prefix.length))) {
    return NextResponse.json({ error: { message: t.api.invalidRequest } }, { status: 400 });
  }

  const supabase = await createClient();
  const bucket = supabase.storage.from(STORAGE_BUCKET.ATTACHMENTS);

  async function discardUpload() {
    const { error } = await bucket.remove([storagePath]);
    if (error) console.error("[api/delivery-notes:POST] could not remove upload", error);
  }

  try {
    const { data: file, error: downloadError } = await bucket.download(storagePath);
    if (downloadError || !file) {
      return NextResponse.json({ error: { message: t.api.fileMissing } }, { status: 400 });
    }

    const header = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
    if (header !== "%PDF-") {
      await discardUpload();
      return NextResponse.json({ error: { message: t.api.notPdf } }, { status: 400 });
    }

    const { data: noteId, error } = await supabase.rpc("add_delivery_note", {
      p_requisition_id: requisitionId,
      p_storage_path: storagePath,
      p_original_filename: originalFilename,
    });

    if (error) {
      await discardUpload();
      if (error.code === "55000" || error.code === "P0002") {
        return NextResponse.json({ error: { message: t.api.notEligible } }, { status: 409 });
      }
      if (error.code === "55001") {
        return NextResponse.json({ error: { message: t.api.maxReached } }, { status: 409 });
      }
      if (error.code === "23514") {
        return NextResponse.json({ error: { message: t.api.invalidRequest } }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json(
      { data: { id: noteId, originalFilename, createdAt: new Date().toISOString() } },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api/delivery-notes:POST]", error);
    return NextResponse.json({ error: { message: t.api.saveError } }, { status: 500 });
  }
}
