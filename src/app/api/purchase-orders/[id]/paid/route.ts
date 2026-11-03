import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import { createClient } from "@/lib/supabase/server";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const t = en.staff.invoiceLog;

// POST — record that the vendor's proforma has been paid (payment itself
// happens outside the app). No body.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: { message: t.markPaidError } }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("mark_purchase_order_paid", { p_requisition_id: id });

    if (error) {
      if (error.code === "55000" || error.code === "55001") {
        return NextResponse.json({ error: { message: error.message } }, { status: 409 });
      }
      console.error("[api/purchase-orders/[id]/paid:POST]", error);
      return NextResponse.json({ error: { message: t.markPaidError } }, { status: 500 });
    }

    return NextResponse.json({ data: { paidAt: data } });
  } catch (error) {
    console.error("[api/purchase-orders/[id]/paid:POST]", error);
    return NextResponse.json({ error: { message: t.markPaidError } }, { status: 500 });
  }
}
