import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { createClient } from "@/lib/supabase/server";

const t = en.vendorQuote;

// Deliberately NOT requireApiActiveUser() — called by an anonymous vendor
// with no session. submit_rfq_link validates the token itself (single-use +
// expiry, atomically) inside its own security-definer body instead. No
// src/proxy.ts change needed either: /api/* paths are already fully
// exempted from the page-gating logic before it runs — a public API route
// just needs to omit the staff-auth call, nothing else.
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("submit_rfq_link", { p_token: token }).single();

  if (error) {
    console.error("[api/quote/[token]/submit:POST]", error);
    return NextResponse.json({ error: { message: t.submitError } }, { status: 500 });
  }

  if (!data?.success) {
    return NextResponse.json({ error: { message: t.linkInvalid } }, { status: 409 });
  }

  return NextResponse.json({ data: { success: true } });
}
