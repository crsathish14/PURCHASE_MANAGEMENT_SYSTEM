import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import { createClient } from "@/lib/supabase/server";
import { requireApiAdmin } from "@/lib/supabase/require-active-user";
import { addVendorSchema } from "@/lib/validation/vendor";

const t = en.staff.vendors;
const VENDOR_COLUMNS = "id, name, pic, address, mail, contact, gst, created_at";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: { message: t.updateError } }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }

  const parsed = addVendorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues[0]?.message ?? t.updateError } },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendors")
    .update(parsed.data)
    .eq("id", id)
    .select(VENDOR_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("[api/vendors/[id]:PATCH]", error);
    return NextResponse.json({ error: { message: t.updateError } }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: { message: t.updateError } }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: data.id,
      name: data.name,
      pic: data.pic,
      address: data.address,
      mail: data.mail,
      contact: data.contact,
      gst: data.gst,
      createdAt: data.created_at,
    },
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: { message: t.removeError } }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("vendors").delete().eq("id", id).select("id").maybeSingle();

  if (error) {
    if (error.code === "23503") {
      return NextResponse.json({ error: { message: t.removeLinkedError } }, { status: 409 });
    }
    console.error("[api/vendors/[id]:DELETE]", error);
    return NextResponse.json({ error: { message: t.removeError } }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: { message: t.removeError } }, { status: 404 });
  }

  return NextResponse.json({ data: { id: data.id } });
}
