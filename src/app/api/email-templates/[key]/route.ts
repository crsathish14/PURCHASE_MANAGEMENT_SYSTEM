import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import { isEmailTemplateKey } from "@/lib/constants/email-template";
import { requireApiAdmin } from "@/lib/supabase/require-active-user";
import { createClient } from "@/lib/supabase/server";

const t = en.staff.emailTemplates;

const updateSchema = z.object({
  subject: z.string().trim().min(1, { error: t.errors.subjectRequired }).max(300),
  body: z.string().trim().min(1, { error: t.errors.bodyRequired }).max(10000),
});

// Settings > Email Templates save. Admin-only here and by RLS (email_templates_update_admin).
export async function PUT(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;

  const { key } = await params;
  if (!isEmailTemplateKey(key)) {
    return NextResponse.json({ error: { message: t.saveError } }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues[0]?.message ?? t.saveError } },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_templates")
    .update({
      subject: parsed.data.subject,
      body: parsed.data.body,
      updated_by: auth.session.user.id,
    })
    .eq("key", key)
    .select("key, subject, body, updated_at")
    .maybeSingle();

  if (error) {
    console.error("[api/email-templates/[key]:PUT]", error);
    return NextResponse.json({ error: { message: t.saveError } }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: { message: t.saveError } }, { status: 404 });
  }

  return NextResponse.json({
    data: { key: data.key, subject: data.subject, body: data.body, updatedAt: data.updated_at },
  });
}
