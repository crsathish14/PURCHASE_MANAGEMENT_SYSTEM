import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import { savePurchaseOrderDraft } from "@/lib/data/purchase-orders";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const t = en.staff.purchaseOrders;
const draftSchema = z.object({
  sameAsQuoteQty: z.boolean(),
  items: z.array(
    z.object({
      quotationItemId: z.uuid(),
      neededPoQty: z.number().finite().nonnegative(),
    }),
  ),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }

  const parsed = draftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { message: t.invalidDraft } }, { status: 400 });
  }

  try {
    const draftId = await savePurchaseOrderDraft({
      requisitionId: id,
      items: parsed.data.items,
      sameAsQuoteQty: parsed.data.sameAsQuoteQty,
    });
    return NextResponse.json({ data: { id: draftId } });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "P0002") {
      return NextResponse.json({ error: { message: t.draftNotFound } }, { status: 404 });
    }
    if (code === "55000") {
      return NextResponse.json({ error: { message: t.draftConflict } }, { status: 409 });
    }
    if (["23514", "22P02"].includes(code ?? "")) {
      return NextResponse.json({ error: { message: t.invalidDraft } }, { status: 400 });
    }

    console.error("[api/purchase-orders/[id]/draft:PUT]", error);
    return NextResponse.json({ error: { message: t.draftSaveError } }, { status: 500 });
  }
}
