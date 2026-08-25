import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { getVessels } from "@/lib/data/vessels";
import { createClient } from "@/lib/supabase/server";
import { requireApiActiveUser, requireApiAdmin } from "@/lib/supabase/require-active-user";
import { addVesselSchema } from "@/lib/validation/vessel";

const t = en.staff.vessels;

// Any active user can list vessels — the Create Requisition dropdown reads
// this same list (indirectly, via pr_dropdown_field_options), so it isn't
// admin-only like the write side below.
export async function GET() {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  try {
    const vessels = await getVessels();
    return NextResponse.json({ data: vessels });
  } catch (error) {
    console.error("[api/vessels:GET]", error);
    return NextResponse.json({ error: { message: t.loadError } }, { status: 500 });
  }
}

// Admin-only: adds a vessel via the add_vessel() DB function, which also
// mirrors it into pr_dropdown_field_options so it appears in the Create
// Requisition vessel dropdown — see 20260824000000_vessels_table.sql.
export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }

  const parsed = addVesselSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues[0]?.message ?? t.addError } },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("add_vessel", { p_name: parsed.data.name, p_imo_no: parsed.data.imoNo })
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      const message = error.message.includes("imo_no") ? t.addErrors.imoNoInUse : t.addErrors.nameInUse;
      return NextResponse.json({ error: { message } }, { status: 409 });
    }
    console.error("[api/vessels:POST]", error);
    return NextResponse.json({ error: { message: t.addError } }, { status: 500 });
  }

  return NextResponse.json(
    { data: { id: data.id, name: data.name, imoNo: data.imo_no, createdAt: data.created_at } },
    { status: 201 },
  );
}
