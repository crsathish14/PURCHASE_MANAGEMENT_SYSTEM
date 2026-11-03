import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import { DELIVERY_NOTE_MIME_TYPE, STORAGE_BUCKET } from "@/lib/constants/storage";
import { getDeliveryNoteById } from "@/lib/data/delivery-notes";
import { sanitizeFilenameSegment } from "@/lib/format";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";
import { createClient } from "@/lib/supabase/server";

const t = en.staff.deliveryNotes.api;

// Streams one delivery note PDF inline to an active staff session.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: { message: t.invalidRequest } }, { status: 400 });
  }

  try {
    const note = await getDeliveryNoteById(id);
    if (!note) {
      return NextResponse.json({ error: { message: t.notFound } }, { status: 404 });
    }

    const supabase = await createClient();
    const { data: file, error } = await supabase.storage.from(STORAGE_BUCKET.ATTACHMENTS).download(note.storagePath);
    if (error || !file) {
      return NextResponse.json({ error: { message: t.notFound } }, { status: 404 });
    }

    const baseName = note.originalFilename.replace(/\.pdf$/i, "");
    const filename = `${sanitizeFilenameSegment(baseName) || "delivery-note"}.pdf`;

    return new NextResponse(new Uint8Array(await file.arrayBuffer()), {
      status: 200,
      headers: {
        "Content-Type": DELIVERY_NOTE_MIME_TYPE,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[api/delivery-notes/[id]/file:GET]", error);
    return NextResponse.json({ error: { message: t.viewError } }, { status: 500 });
  }
}
