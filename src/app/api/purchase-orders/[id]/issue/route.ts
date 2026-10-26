import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import { env } from "@/lib/env";
import { purchaseOrderFormPath } from "@/lib/routes";
import { getPurchaseOrderIssueToken, issuePurchaseOrder } from "@/lib/data/purchase-orders";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const t = en.staff.purchaseOrders;
const issueSchema = z.object({
  sameAsQuoteQty: z.boolean(),
  items: z.array(
    z.object({
      quotationItemId: z.uuid(),
      neededPoQty: z.number().finite().nonnegative(),
    }),
  ),
  message: z.string().trim().min(1).max(10000),
  invoiceCompanyName: z.string().trim().min(1).max(200),
  invoiceAddress: z.string().max(2000),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const token = await getPurchaseOrderIssueToken(id);
    if (!token) {
      return NextResponse.json({ error: { message: t.issuedLinkNotFound } }, { status: 404 });
    }

    return NextResponse.json({ data: { link: `${env.NEXT_PUBLIC_SITE_URL}${purchaseOrderFormPath(token)}` } });
  } catch (error) {
    console.error("[api/purchase-orders/[id]/issue:GET]", error);
    return NextResponse.json({ error: { message: t.issuedLinkLoadError } }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }

  const parsed = issueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { message: t.invalidIssueDetails } }, { status: 400 });
  }

  try {
    const token = await issuePurchaseOrder({
      requisitionId: id,
      items: parsed.data.items,
      sameAsQuoteQty: parsed.data.sameAsQuoteQty,
      message: parsed.data.message,
      invoiceCompanyName: parsed.data.invoiceCompanyName,
      invoiceAddress: parsed.data.invoiceAddress,
    });
    const link = `${env.NEXT_PUBLIC_SITE_URL}${purchaseOrderFormPath(token)}`;
    return NextResponse.json({
      data: {
        link,
        message: `${parsed.data.message}\n\n${link}`,
      },
    });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "P0002") {
      return NextResponse.json({ error: { message: t.draftNotFound } }, { status: 404 });
    }
    if (code === "55000" || code === "23505") {
      return NextResponse.json({ error: { message: t.alreadyIssued } }, { status: 409 });
    }
    if (["23514", "22P02"].includes(code ?? "")) {
      return NextResponse.json({ error: { message: t.invalidIssueDetails } }, { status: 400 });
    }

    console.error("[api/purchase-orders/[id]/issue:POST]", error);
    return NextResponse.json({ error: { message: t.issueError } }, { status: 500 });
  }
}
