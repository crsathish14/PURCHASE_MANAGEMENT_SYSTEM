import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { getVendors } from "@/lib/data/vendors";
import { createClient } from "@/lib/supabase/server";
import { requireApiActiveUser, requireApiAdmin } from "@/lib/supabase/require-active-user";
import { addVendorSchema } from "@/lib/validation/vendor";

const t = en.staff.vendors;
const VENDOR_COLUMNS = "id, name, pic, address, mail, contact, gst, created_at";

// Active staff can read saved vendor details while issuing RFQs; writes remain
// restricted to admins in the handlers below.
export async function GET() {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  try {
    const vendors = await getVendors();
    return NextResponse.json({ data: vendors });
  } catch (error) {
    console.error("[api/vendors:GET]", error);
    return NextResponse.json({ error: { message: t.loadError } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }

  const parsed = addVendorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues[0]?.message ?? t.addError } },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendors")
    .insert(parsed.data)
    .select(VENDOR_COLUMNS)
    .single();

  if (error || !data) {
    console.error("[api/vendors:POST]", error);
    return NextResponse.json({ error: { message: t.addError } }, { status: 500 });
  }

  return NextResponse.json(
    {
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
    },
    { status: 201 },
  );
}
