import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { getRfqQuoteLineItemsPage } from "@/lib/data/rfq-quote";
import {
  isQuoteLineItemPageSize,
  QUOTE_LINE_ITEM_DEFAULT_PAGE_SIZE,
} from "@/lib/vendor-quote/pagination";

const t = en.vendorQuote;

// Deliberately NOT requireApiActiveUser() — called by an anonymous vendor with
// no session, same as the rest of api/quote/[token]. The RPC behind
// getRfqQuoteLineItemsPage validates the token itself (exists, not expired,
// not submitted) and returns nothing otherwise. Query params are
// coerce-never-fail, like api/requested-quotes: an out-of-range page size
// falls back to the default instead of erroring.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { searchParams } = new URL(request.url);

  const rawPage = Number(searchParams.get("page"));
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  const rawPageSize = Number(searchParams.get("pageSize"));
  const pageSize = isQuoteLineItemPageSize(rawPageSize) ? rawPageSize : QUOTE_LINE_ITEM_DEFAULT_PAGE_SIZE;

  try {
    const result = await getRfqQuoteLineItemsPage(token, page, pageSize);
    if (!result) {
      return NextResponse.json({ error: { message: t.linkInvalid } }, { status: 409 });
    }
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("[api/quote/[token]/items:GET]", error);
    return NextResponse.json({ error: { message: t.pagination.loadError } }, { status: 500 });
  }
}
