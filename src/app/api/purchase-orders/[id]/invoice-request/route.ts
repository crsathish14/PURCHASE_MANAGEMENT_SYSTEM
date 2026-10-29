import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const t = en.staff.invoiceLog;

const createSchema = z.object({
  vendorEmail: z.string().email(),
  message: z.string().trim().min(1).max(5000),
});

// POST — create an invoice-request link for the given requisition.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: { message: t.requestInvoiceError } }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: t.requestInvoiceError } }, { status: 400 });
  }

  const result = createSchema.safeParse(body);
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? t.requestInvoiceError;
    return NextResponse.json({ error: { message: msg } }, { status: 400 });
  }

  const { vendorEmail, message } = result.data;

  try {
    const supabase = await createClient();
    const { data: token, error } = await supabase.rpc("request_purchase_order_invoice", {
      p_requisition_id: id,
      p_vendor_email: vendorEmail,
      p_message: message,
    });

    if (error) {
      if (error.code === "55000" || error.code === "55001") {
        return NextResponse.json({ error: { message: error.message } }, { status: 409 });
      }
      console.error("[api/purchase-orders/[id]/invoice-request:POST]", error);
      return NextResponse.json({ error: { message: t.requestInvoiceError } }, { status: 500 });
    }

    const origin = new URL(request.url).origin;
    const link = `${origin}${ROUTES.PURCHASE_ORDER_INVOICE_FORM}/${token as string}`;
    return NextResponse.json({ data: { token, link } });
  } catch (error) {
    console.error("[api/purchase-orders/[id]/invoice-request:POST]", error);
    return NextResponse.json({ error: { message: t.requestInvoiceError } }, { status: 500 });
  }
}

// GET — retrieve the pending invoice link token for "Copy Link".
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: { message: t.fetchTokenError } }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: token, error } = await supabase.rpc("get_purchase_order_invoice_link_token", {
      p_requisition_id: id,
    });

    if (error) {
      console.error("[api/purchase-orders/[id]/invoice-request:GET]", error);
      return NextResponse.json({ error: { message: t.fetchTokenError } }, { status: 500 });
    }

    if (!token) {
      return NextResponse.json({ error: { message: t.fetchTokenError } }, { status: 404 });
    }

    const origin = new URL(request.url).origin;
    const link = `${origin}${ROUTES.PURCHASE_ORDER_INVOICE_FORM}/${token as string}`;
    return NextResponse.json({ data: { token, link } });
  } catch (error) {
    console.error("[api/purchase-orders/[id]/invoice-request:GET]", error);
    return NextResponse.json({ error: { message: t.fetchTokenError } }, { status: 500 });
  }
}
