import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";
import { createClient } from "@/lib/supabase/server";

const t = en.staff.poRequests.table;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_purchase_requisition", { p_id: id }).single();

  if (error || !data) {
    console.error("[api/purchase-requisitions/[id]/duplicate:POST]", error);
    return NextResponse.json({ error: { message: t.duplicateError } }, { status: 500 });
  }

  return NextResponse.json({ data: { id: data.id, prNumber: data.pr_number } }, { status: 201 });
}
