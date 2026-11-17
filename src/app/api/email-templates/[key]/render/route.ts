import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import { isEmailTemplateKey } from "@/lib/constants/email-template";
import { getRenderedEmailTemplate } from "@/lib/data/email-templates";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const t = en.staff.emailTemplates;

// The saved template with the requisition's details filled in, for the issue/request
// dialogs to show. [Insert Link] stays in the text — the link is created on submit.
export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { key } = await params;
  const requisitionId = new URL(request.url).searchParams.get("requisitionId") ?? "";
  if (!isEmailTemplateKey(key) || !z.uuid().safeParse(requisitionId).success) {
    return NextResponse.json({ error: { message: t.loadError } }, { status: 400 });
  }

  try {
    const rendered = await getRenderedEmailTemplate(key, requisitionId);
    if (!rendered) {
      return NextResponse.json({ error: { message: t.loadError } }, { status: 404 });
    }
    return NextResponse.json({ data: rendered });
  } catch (error) {
    console.error("[api/email-templates/[key]/render:GET]", error);
    return NextResponse.json({ error: { message: t.loadError } }, { status: 500 });
  }
}
