import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";
import { buildQuoteDraftSaveSchema, MAX_QUOTE_DRAFT_BYTES } from "@/lib/vendor-quote/draft";

const t = en.vendorQuote;

// Deliberately NOT requireApiActiveUser() — called by an anonymous vendor with
// no session, same as api/quote/[token]/submit. save_rfq_quote_draft validates
// the token itself (exists, not expired, not submitted) inside its
// security-definer body, so there is deliberately no getRfqQuoteDetailsByToken
// call here: that signs every line item's photos, which would be far too heavy
// for something that fires every few seconds while the vendor types.
export async function PUT(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const raw = await request.text();
  if (raw.length > MAX_QUOTE_DRAFT_BYTES) {
    return NextResponse.json({ error: { message: t.draft.tooLarge } }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: { message: t.draft.saveError } }, { status: 400 });
  }

  const parsed = buildQuoteDraftSaveSchema(token).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { message: t.draft.saveError } }, { status: 400 });
  }

  // The RPC takes the items keyed by line item id and merges each into the
  // stored draft, so a save for one page (or one late photo upload) never
  // erases the vendor's entries on any other page.
  const items: Record<string, { fields?: Record<string, string>; photos?: unknown[] }> = {};
  for (const { lineItemId, ...entry } of parsed.data.items) items[lineItemId] = entry;

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("save_rfq_quote_draft", {
      p_token: token,
      p_header: parsed.data.header,
      p_items: items as Json,
    })
    .single();

  if (error) {
    console.error("[api/quote/[token]/draft:PUT]", error);
    return NextResponse.json({ error: { message: t.draft.saveError } }, { status: 500 });
  }

  if (!data?.success || !data.saved_at) {
    return NextResponse.json({ error: { message: t.linkInvalid } }, { status: 409 });
  }

  return NextResponse.json({ data: { savedAt: data.saved_at } });
}
