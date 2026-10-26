import { NextResponse } from "next/server";
import { z } from "zod";

import en from "@/locales/en.json";
import { createClient } from "@/lib/supabase/server";
import { requireApiAdmin } from "@/lib/supabase/require-active-user";
import { updateVesselDetailsSchema } from "@/lib/validation/vessel";

const t = en.staff.vessels;
const VESSEL_COLUMNS = "id, name, imo_no, master_owners, company_name, address, created_at";

// Vessel name and IMO No are left unchanged because requisitions use the name
// as their existing dropdown value. This route updates the descriptive fields.
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

  const parsed = updateVesselDetailsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues[0]?.message ?? t.updateError } },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vessels")
    .update({
      master_owners: parsed.data.masterOwners,
      company_name: parsed.data.companyName,
      address: parsed.data.address,
    })
    .eq("id", id)
    .select(VESSEL_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("[api/vessels/[id]:PATCH]", error);
    return NextResponse.json({ error: { message: t.updateError } }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: { message: t.updateError } }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: data.id,
      name: data.name,
      imoNo: data.imo_no,
      masterOwners: data.master_owners,
      companyName: data.company_name,
      address: data.address,
      createdAt: data.created_at,
    },
  });
}
