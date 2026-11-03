import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import { STORAGE_BUCKET } from "@/lib/constants/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const t = en.staff.invoiceLog;

// POST — discard the received tax invoice (and supporting documents) so the PO
// returns to Invoice Requested and its existing vendor link accepts a new
// upload. No body.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: { message: t.rerequestInvoiceError } }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: paths, error } = await supabase.rpc("rerequest_purchase_order_invoice", {
      p_requisition_id: id,
    });

    if (error) {
      if (error.code === "55000") {
        return NextResponse.json({ error: { message: error.message } }, { status: 409 });
      }
      console.error("[api/purchase-orders/[id]/invoice-rerequest:POST]", error);
      return NextResponse.json({ error: { message: t.rerequestInvoiceError } }, { status: 500 });
    }

    // The database no longer references the files, so a failed Storage removal
    // is logged rather than surfaced — the invoice was re-requested successfully.
    if (paths && paths.length > 0) {
      const { error: removeError } = await createAdminClient()
        .storage.from(STORAGE_BUCKET.ATTACHMENTS)
        .remove(paths);
      if (removeError) {
        console.error("[api/purchase-orders/[id]/invoice-rerequest:POST] document removal failed", removeError);
      }
    }

    return NextResponse.json({ data: { rerequested: true } });
  } catch (error) {
    console.error("[api/purchase-orders/[id]/invoice-rerequest:POST]", error);
    return NextResponse.json({ error: { message: t.rerequestInvoiceError } }, { status: 500 });
  }
}
