import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import { STORAGE_BUCKET } from "@/lib/constants/storage";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";
import { createClient } from "@/lib/supabase/server";

const t = en.staff.deliveryNotes.api;

// Deletes the note row first, then its Storage object. A failed object removal
// is logged but not surfaced: the note is already gone from the app, and an
// orphaned private PDF is harmless next to failing a delete that succeeded.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: { message: t.invalidRequest } }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: storagePath, error } = await supabase.rpc("delete_delivery_note", { p_id: id });

    if (error) {
      if (error.code === "P0002") {
        return NextResponse.json({ error: { message: t.notFound } }, { status: 404 });
      }
      throw error;
    }

    const { error: removeError } = await supabase.storage.from(STORAGE_BUCKET.ATTACHMENTS).remove([storagePath]);
    if (removeError) console.error("[api/delivery-notes/[id]:DELETE] could not remove file", removeError);

    return NextResponse.json({ data: { id } });
  } catch (error) {
    console.error("[api/delivery-notes/[id]:DELETE]", error);
    return NextResponse.json({ error: { message: t.deleteError } }, { status: 500 });
  }
}
