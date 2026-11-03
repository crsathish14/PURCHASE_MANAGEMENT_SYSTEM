import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import {
  DELIVERY_NOTE_MIME_TYPE,
  DELIVERY_NOTE_PATH_PREFIX,
  MAX_DELIVERY_NOTES_PER_REQUISITION,
  STORAGE_BUCKET,
} from "@/lib/constants/storage";
import { countDeliveryNotes } from "@/lib/data/delivery-notes";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";
import { createClient } from "@/lib/supabase/server";

const t = en.staff.deliveryNotes.api;

const signSchema = z.object({
  requisitionId: z.uuid(),
  fileName: z.string().min(1).max(500),
  contentType: z.literal(DELIVERY_NOTE_MIME_TYPE, { error: t.notPdf }),
});

// Mints a signed upload URL for one delivery note PDF. The object key is built
// entirely server-side (the client's fileName is display metadata only), and a
// requisition already at the cap is refused up front so the upload is never
// wasted — add_delivery_note re-checks it authoritatively on registration.
export async function POST(request: Request) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: t.invalidRequest } }, { status: 400 });
  }

  const parsed = signSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues[0]?.message ?? t.invalidRequest } },
      { status: 400 },
    );
  }
  const { requisitionId } = parsed.data;

  try {
    if ((await countDeliveryNotes(requisitionId)) >= MAX_DELIVERY_NOTES_PER_REQUISITION) {
      return NextResponse.json({ error: { message: t.maxReached } }, { status: 409 });
    }

    const storagePath = `${DELIVERY_NOTE_PATH_PREFIX}/${requisitionId}/${crypto.randomUUID()}.pdf`;
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET.ATTACHMENTS)
      .createSignedUploadUrl(storagePath);

    if (error || !data) throw error ?? new Error("No signed upload URL returned");

    return NextResponse.json({ data: { storagePath: data.path, token: data.token } });
  } catch (error) {
    console.error("[api/delivery-notes/sign:POST]", error);
    return NextResponse.json({ error: { message: t.uploadError } }, { status: 500 });
  }
}
