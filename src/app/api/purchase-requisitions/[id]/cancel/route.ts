import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";
import { createClient } from "@/lib/supabase/server";

const t = en.staff.poRequests.table;

// cancel_purchase_requisition's own guard: already awarded/cancelled.
const CONFLICT_PG_CODE = "55000";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_purchase_requisition", { p_id: id }).single();

  if (error || !data) {
    if (error?.code === CONFLICT_PG_CODE) {
      return NextResponse.json(
        { error: { message: "This requisition can no longer be cancelled." } },
        { status: 409 },
      );
    }
    console.error("[api/purchase-requisitions/[id]/cancel:POST]", error);
    return NextResponse.json({ error: { message: t.cancelError } }, { status: 500 });
  }

  return NextResponse.json({ data: { id: data.id, status: data.status } });
}
