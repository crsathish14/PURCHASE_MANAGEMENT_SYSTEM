import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import { STORAGE_BUCKET } from "@/lib/constants/storage";
import { reissuePurchaseOrder } from "@/lib/data/purchase-orders";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const t = en.staff.purchaseOrders;

// POST — discard the received proforma so the PO returns to PO Issued and its
// vendor link accepts a new upload. No body.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: { message: t.reissueError } }, { status: 400 });
  }

  try {
    const proformaPath = await reissuePurchaseOrder(id);

    // The database no longer references the file, so a failed Storage removal
    // is logged rather than surfaced — the PO itself was reissued successfully.
    if (proformaPath) {
      const { error: removeError } = await createAdminClient()
        .storage.from(STORAGE_BUCKET.ATTACHMENTS)
        .remove([proformaPath]);
      if (removeError) {
        console.error("[api/purchase-orders/[id]/reissue:POST] proforma removal failed", removeError);
      }
    }

    return NextResponse.json({ data: { reissued: true } });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "55000" || code === "55001") {
      return NextResponse.json({ error: { message: (error as Error).message } }, { status: 409 });
    }

    console.error("[api/purchase-orders/[id]/reissue:POST]", error);
    return NextResponse.json({ error: { message: t.reissueError } }, { status: 500 });
  }
}
