import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import type { PrPriority } from "@/lib/constants/purchase-requisition";
import { STORAGE_BUCKET } from "@/lib/constants/storage";
import {
  getPrDropdownFields,
  getPurchaseRequisitionAttachmentPaths,
  getPurchaseRequisitionById,
} from "@/lib/data/purchase-requisition";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";
import { createClient } from "@/lib/supabase/server";
import { buildCreateRequisitionSchema } from "@/lib/validation/purchase-requisition";

const t = en.staff.poRequests.createDialog;

// A stale/invalid dropdown option surfaces as a Postgres FK violation — a
// client-fixable 400, not a server error. 55000 is update_purchase_requisition's
// own "only pending_rfq can be edited" / race-lost guard — a conflict with
// current state, not a malformed request.
const CLIENT_ERROR_PG_CODES = new Set(["23503", "23514"]);
const CONFLICT_PG_CODE = "55000";
// update_purchase_requisition's own "category cannot be changed after a
// requisition is created" guard — a distinct client-fixable 400, not the
// generic stale-option-value message the other CLIENT_ERROR_PG_CODES get.
const CATEGORY_LOCKED_PG_CODE = "55001";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const detail = await getPurchaseRequisitionById(id);
    if (!detail) {
      return NextResponse.json({ error: { message: "Requisition not found." } }, { status: 404 });
    }
    return NextResponse.json({ data: detail });
  } catch (error) {
    console.error("[api/purchase-requisitions/[id]:GET]", error);
    return NextResponse.json(
      { error: { message: en.staff.poRequests.table.detailLoadError } },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }

  // Same schema POST already validates against — the edit form's payload
  // shape is identical to create's, so no separate schema is needed.
  const dropdownFields = await getPrDropdownFields();
  const schema = buildCreateRequisitionSchema(dropdownFields);
  const result = schema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return NextResponse.json(
      { error: { message: firstIssue?.message ?? t.updateError } },
      { status: 400 },
    );
  }

  const data = result.data;
  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .rpc("update_purchase_requisition", {
      p_id: id,
      p_priority: data.priority as PrPriority,
      p_requested_by: data.requestedBy || null,
      p_required_port: data.requiredPort || null,
      p_remarks: data.remarks || null,
      p_requisition_number: data.requisitionNumber || null,
      p_dropdowns: data.dropdowns,
      p_custom_fields: data.customFields,
      p_columns: data.columns,
      p_line_items: data.lineItems,
    })
    .single();

  if (error || !updated) {
    if (error?.code === CONFLICT_PG_CODE) {
      return NextResponse.json(
        { error: { message: "This requisition can no longer be edited. Refresh and try again." } },
        { status: 409 },
      );
    }
    if (error?.code === CATEGORY_LOCKED_PG_CODE) {
      return NextResponse.json(
        { error: { message: "Category can't be changed after a requisition is created." } },
        { status: 400 },
      );
    }
    const status = error?.code && CLIENT_ERROR_PG_CODES.has(error.code) ? 400 : 500;
    if (status === 500) console.error("[api/purchase-requisitions/[id]:PATCH]", error);
    return NextResponse.json(
      {
        error: {
          message:
            status === 400
              ? "One or more selected options are no longer valid. Refresh and try again."
              : t.updateError,
        },
      },
      { status },
    );
  }

  return NextResponse.json({ data: { id: updated.id, prNumber: updated.pr_number } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;

  // Must run BEFORE the RPC — delete_purchase_requisition's cascade removes
  // every purchase_requisition_line_item_attachments row (the only place
  // these storage_path values live) the moment the parent row is deleted.
  let attachmentPaths: string[] = [];
  try {
    attachmentPaths = await getPurchaseRequisitionAttachmentPaths(id);
  } catch (pathsError) {
    console.error("[api/purchase-requisitions/[id]:DELETE] attachment path lookup failed", pathsError);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_purchase_requisition", { p_id: id }).single();

  if (error || !data) {
    if (error?.code === CONFLICT_PG_CODE) {
      return NextResponse.json(
        { error: { message: "Only requisitions pending RFQ can be deleted." } },
        { status: 409 },
      );
    }
    if (error?.code === "P0002") {
      return NextResponse.json({ error: { message: "Requisition not found." } }, { status: 404 });
    }
    console.error("[api/purchase-requisitions/[id]:DELETE]", error);
    return NextResponse.json(
      { error: { message: en.staff.poRequests.table.deleteError } },
      { status: 500 },
    );
  }

  // Best-effort: the DB row is already gone (permanent, no soft-delete) — a
  // Storage cleanup failure here shouldn't make the client think the delete
  // itself failed.
  if (attachmentPaths.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(STORAGE_BUCKET.ATTACHMENTS)
      .remove(attachmentPaths);
    if (removeError) {
      console.error("[api/purchase-requisitions/[id]:DELETE] storage cleanup failed", removeError);
    }
  }

  return NextResponse.json({ data: { id: data.id } });
}
