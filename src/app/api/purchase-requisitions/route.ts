import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import type { PrPriority } from "@/lib/constants/purchase-requisition";
import { getPrDropdownFields, getPurchaseRequisitions } from "@/lib/data/purchase-requisition";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { buildCreateRequisitionSchema } from "@/lib/validation/purchase-requisition";

const t = en.staff.poRequests.createDialog;

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 20;

// A stale/invalid dropdown option no longer being one of that field's real
// values (e.g. an option was removed from Studio between page-load and
// submit) surfaces as a Postgres foreign-key violation from the RPC's
// composite FK — that's a client-fixable 400, not a server error.
const CLIENT_ERROR_PG_CODES = new Set(["23503", "23514"]);

export async function GET(request: Request) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const requestedPage = Number(searchParams.get("page"));
  const requestedPageSize = Number(searchParams.get("pageSize"));

  const page = Number.isInteger(requestedPage) && requestedPage >= 1 ? requestedPage : 1;
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize) ? requestedPageSize : DEFAULT_PAGE_SIZE;

  try {
    const { rows, total } = await getPurchaseRequisitions({ page, pageSize });
    return NextResponse.json({ data: rows, meta: { page, pageSize, total } });
  } catch (error) {
    console.error("[api/purchase-requisitions:GET]", error);
    return NextResponse.json(
      { error: { message: "Couldn't load purchase requisitions." } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }

  // Never trust a client-supplied field roster — fetch the live dropdown
  // fields fresh and re-validate against them server-side, mirroring the
  // exact schema the client already validates against (buildCreateRequisitionSchema
  // is parametrized by live data, so this gives byte-for-byte parity with the
  // client at zero duplication cost).
  const dropdownFields = await getPrDropdownFields();
  const schema = buildCreateRequisitionSchema(dropdownFields);
  const result = schema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return NextResponse.json(
      { error: { message: firstIssue?.message ?? t.createError } },
      { status: 400 },
    );
  }

  const data = result.data;
  const supabase = await createClient();
  const { data: created, error } = await supabase
    .rpc("create_purchase_requisition", {
      p_priority: data.priority as PrPriority,
      p_requested_by: data.requestedBy || null,
      p_required_port: data.requiredPort || null,
      p_remarks: data.remarks || null,
      p_dropdowns: data.dropdowns,
      p_custom_fields: data.customFields,
      p_columns: data.columns,
      p_line_items: data.lineItems,
    })
    .single();

  if (error || !created) {
    const status = error?.code && CLIENT_ERROR_PG_CODES.has(error.code) ? 400 : 500;
    if (status === 500) console.error("[api/purchase-requisitions:POST]", error);
    return NextResponse.json(
      {
        error: {
          message:
            status === 400
              ? "One or more selected options are no longer valid. Refresh and try again."
              : t.createError,
        },
      },
      { status },
    );
  }

  return NextResponse.json(
    { data: { id: created.id, prNumber: created.pr_number } },
    { status: 201 },
  );
}
