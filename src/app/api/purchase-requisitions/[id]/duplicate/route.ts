import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { PR_LINE_ITEM_PHOTO_PATH_PREFIX, STORAGE_BUCKET } from "@/lib/constants/storage";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";
import { createClient } from "@/lib/supabase/server";

const t = en.staff.poRequests.table;

// duplicate_purchase_requisition's own "only pending_rfq can be duplicated"
// guard — this repo's shared "wrong status for this mutation" code (see
// CONFLICT_PG_CODE in src/app/api/purchase-requisitions/[id]/route.ts).
const CONFLICT_PG_CODE = "55000";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_purchase_requisition", { p_id: id }).single();

  if (error || !data) {
    if (error?.code === CONFLICT_PG_CODE) {
      return NextResponse.json({ error: { message: t.duplicateConflictError } }, { status: 409 });
    }
    console.error("[api/purchase-requisitions/[id]/duplicate:POST]", error);
    return NextResponse.json({ error: { message: t.duplicateError } }, { status: 500 });
  }

  await duplicateLineItemPhotos(supabase, data.id, (data.line_item_id_map ?? {}) as Record<string, string>);

  return NextResponse.json({ data: { id: data.id, prNumber: data.pr_number } }, { status: 201 });
}

// Best-effort, same treatment DELETE's own Storage cleanup gets: the
// duplicated requisition (and every other copied field) already exists
// successfully by the time this runs, so a photo-copy failure here shouldn't
// make the client think duplication itself failed. Split from the RPC above
// because actually copying a Storage object needs the Storage API, which
// plain SQL can't reach — the RPC only hands back an old-line-item-id ->
// new-line-item-id map to drive this.
async function duplicateLineItemPhotos(
  supabase: Supabase,
  newRequisitionId: string,
  lineItemIdMap: Record<string, string>,
) {
  const oldLineItemIds = Object.keys(lineItemIdMap);
  if (oldLineItemIds.length === 0) return;

  const { data: attachments, error: fetchError } = await supabase
    .from("purchase_requisition_line_item_attachments")
    .select("line_item_id, storage_path, file_name, content_type, size_bytes, sort_order")
    .in("line_item_id", oldLineItemIds);

  if (fetchError) {
    console.error("[api/purchase-requisitions/[id]/duplicate:POST] attachment fetch failed", fetchError);
    return;
  }
  if (!attachments || attachments.length === 0) return;

  const copied: {
    lineItemId: string;
    storagePath: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    sortOrder: number;
  }[] = [];

  await Promise.all(
    attachments.map(async (attachment) => {
      const newLineItemId = lineItemIdMap[attachment.line_item_id];
      if (!newLineItemId) return;

      const extension = attachment.storage_path.split(".").pop() || "bin";
      const newStoragePath =
        `${PR_LINE_ITEM_PHOTO_PATH_PREFIX}/${newRequisitionId}/${newLineItemId}/${crypto.randomUUID()}.${extension}`;

      const { error: copyError } = await supabase.storage
        .from(STORAGE_BUCKET.ATTACHMENTS)
        .copy(attachment.storage_path, newStoragePath);

      if (copyError) {
        console.error("[api/purchase-requisitions/[id]/duplicate:POST] storage copy failed", copyError);
        return;
      }

      copied.push({
        lineItemId: newLineItemId,
        storagePath: newStoragePath,
        fileName: attachment.file_name,
        contentType: attachment.content_type,
        sizeBytes: attachment.size_bytes,
        sortOrder: attachment.sort_order,
      });
    }),
  );

  if (copied.length === 0) return;

  const { error: insertError } = await supabase.rpc("duplicate_purchase_requisition_line_item_attachments", {
    p_attachments: copied,
  });
  if (insertError) {
    console.error("[api/purchase-requisitions/[id]/duplicate:POST] attachment insert failed", insertError);
  }
}
