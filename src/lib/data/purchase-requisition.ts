import { createClient } from "@/lib/supabase/server";
import { SIGNED_DISPLAY_URL_TTL_SECONDS, STORAGE_BUCKET } from "@/lib/constants/storage";
import type { DatePreset, PrPriority, PrStatus } from "@/lib/constants/purchase-requisition";

export type PrDropdownFieldOption = {
  value: string;
  label: string;
};

export type PrDropdownField = {
  key: string;
  label: string;
  options: PrDropdownFieldOption[];
};

// Any authenticated user can read this reference data (pr_dropdown_fields_select_authenticated /
// pr_dropdown_field_options_select_authenticated) — it's non-sensitive, and both admin and
// Purchase Officer roles need it to fill the Create Requisition form.
export async function getPrDropdownFields(): Promise<PrDropdownField[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pr_dropdown_fields")
    .select("key, label, sort_order, pr_dropdown_field_options(value, label, sort_order)")
    .order("sort_order", { ascending: true })
    .order("sort_order", { referencedTable: "pr_dropdown_field_options", ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    key: row.key,
    label: row.label,
    options: (row.pr_dropdown_field_options ?? []).map((option) => ({
      value: option.value,
      label: option.label,
    })),
  }));
}

export type PrListRow = {
  id: string;
  prNumber: string;
  priority: PrPriority;
  status: PrStatus;
  createdAt: string;
  vesselLabel: string | null;
  departmentLabel: string | null;
  categoryLabel: string | null;
  itemCount: number;
  requesterName: string | null;
  requisitionNumber: string | null;
};

export type PrListFilters = {
  search?: string;
  statuses?: PrStatus[];
  vessels?: string[];
  categories?: string[];
  datePreset?: DatePreset;
  startDate?: string;
  endDate?: string;
};

// Goes through search_purchase_requisitions (not a plain .from(view).select())
// so status/vessel/category filtering and the remarks-partial/ref-exact
// search can happen server-side with proper indexes, and so total count comes
// back in the same round trip via a count(*) over() window column instead of
// a second count:"exact" pass — see the migration for the full rationale
// (including why the ref match is case-insensitive equality, not ilike, and
// why a page past the end of a filtered set returns zero rows with no total).
export async function getPurchaseRequisitions({
  page,
  pageSize,
  search,
  statuses,
  vessels,
  categories,
  datePreset,
  startDate,
  endDate,
}: {
  page: number;
  pageSize: number;
} & PrListFilters): Promise<{ rows: PrListRow[]; total: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_purchase_requisitions", {
    p_search: search?.trim() ? search.trim() : null,
    p_statuses: statuses?.length ? statuses : null,
    p_vessels: vessels?.length ? vessels : null,
    p_categories: categories?.length ? categories : null,
    p_date_preset: datePreset ?? null,
    p_start_date: startDate ?? null,
    p_end_date: endDate ?? null,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) throw error;

  const rows: PrListRow[] = (data ?? []).map((row) => ({
    id: row.id,
    prNumber: row.pr_number,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
    vesselLabel: row.vessel_label,
    departmentLabel: row.department_label,
    categoryLabel: row.category_label,
    itemCount: row.item_count,
    requesterName: row.requester_name,
    requisitionNumber: row.requisition_number,
  }));

  return { rows, total: data?.[0]?.total_count ?? 0 };
}

export type PrLineItemAttachment = {
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  // Pre-signed, ready-to-render Storage URL — signed here, server-side, so
  // the client never needs its own signing logic for *display* (only for
  // *upload*, via api/uploads/sign). Null if signing this particular path
  // failed (e.g. the underlying object is somehow missing) — the photo tile
  // renders a broken-image fallback rather than the whole PR detail fetch
  // failing.
  url: string | null;
};

export type PrDetail = {
  id: string;
  prNumber: string;
  status: PrStatus;
  priority: PrPriority;
  requestedBy: string | null;
  requiredPort: string | null;
  remarks: string | null;
  requisitionNumber: string | null;
  requisitionDate: string | null;
  title: string | null;
  equipmentName: string | null;
  equipmentType: string | null;
  equipmentMake: string | null;
  equipmentSerialNo: string | null;
  equipmentModel: string | null;
  equipmentSpecifications: string | null;
  equipmentOtherDetails: string | null;
  dropdowns: Record<string, string>;
  customFields: Array<{ label: string; value: string }>;
  columns: Array<{ key: string; label: string }>;
  lineItems: Array<{
    description: string;
    qty: string;
    extra: Record<string, string>;
    attachments: PrLineItemAttachment[];
  }>;
};

// Full detail for the edit/read-only modal — unlike pr_requisition_list
// (list-page summary only), this reads the 5 child tables directly. Each
// column's own id (stringified) doubles as its client-side "key" so
// lineItems[].extra can be correlated with columns[] within one submitted
// payload — update_purchase_requisition always deletes and reinserts columns
// on every save, so the key never needs to persist across saves.
export async function getPurchaseRequisitionById(id: string): Promise<PrDetail | null> {
  const supabase = await createClient();
  // Attachments are fetched as a separate, flat query — NOT nested under
  // purchase_requisition_line_items in the main .select() below, even though
  // that's how purchase_requisition_line_item_values is embedded. PostgREST
  // can't embed two sibling one-to-many relationships three levels deep
  // (purchase_requisitions -> line_items -> {values, attachments}) without
  // erroring `42803: aggregate functions are not allowed in FROM clause of
  // their own query level` (hit and confirmed live against this project).
  // Querying attachments from their own table, inner-joined up to their
  // owning requisition_id, sidesteps that — and runs in parallel with the
  // main query rather than as a dependent second round trip.
  const [{ data, error }, { data: attachmentRows, error: attachmentsError }] = await Promise.all([
    supabase
      .from("purchase_requisitions")
      .select(
        `
        id, pr_number, status, priority, requested_by, required_port, remarks, requisition_number,
        requisition_date, title, equipment_name, equipment_type, equipment_make,
        equipment_serial_no, equipment_model, equipment_specifications, equipment_other_details,
        purchase_requisition_dropdown_values ( option_value, pr_dropdown_fields ( key ) ),
        purchase_requisition_custom_fields ( label, value, sort_order ),
        purchase_requisition_line_item_columns ( id, label, sort_order ),
        purchase_requisition_line_items (
          id, description, qty, sort_order,
          purchase_requisition_line_item_values ( column_id, value )
        )
        `,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("purchase_requisition_line_item_attachments")
      .select(
        "line_item_id, storage_path, file_name, content_type, size_bytes, sort_order, purchase_requisition_line_items!inner(requisition_id)",
      )
      .eq("purchase_requisition_line_items.requisition_id", id),
  ]);

  if (error) throw error;
  if (!data) return null;
  if (attachmentsError) throw attachmentsError;

  const dropdowns = Object.fromEntries(
    (data.purchase_requisition_dropdown_values ?? [])
      .filter((row) => row.pr_dropdown_fields)
      .map((row) => [row.pr_dropdown_fields!.key, row.option_value]),
  );

  const customFields = [...(data.purchase_requisition_custom_fields ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({ label: row.label, value: row.value }));

  const columns = [...(data.purchase_requisition_line_item_columns ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({ key: row.id, label: row.label }));

  const attachmentsByLineItemId = new Map<string, typeof attachmentRows>();
  for (const row of attachmentRows ?? []) {
    const existing = attachmentsByLineItemId.get(row.line_item_id);
    if (existing) existing.push(row);
    else attachmentsByLineItemId.set(row.line_item_id, [row]);
  }

  // One batched createSignedUrls call for every photo across every line item,
  // instead of N createSignedUrl round trips.
  const allStoragePaths = (attachmentRows ?? []).map((row) => row.storage_path);

  const signedUrlByPath = new Map<string, string | null>();
  if (allStoragePaths.length > 0) {
    const { data: signedUrls, error: signError } = await supabase.storage
      .from(STORAGE_BUCKET.ATTACHMENTS)
      .createSignedUrls(allStoragePaths, SIGNED_DISPLAY_URL_TTL_SECONDS);
    if (signError) {
      // A signing failure shouldn't take down the whole PR detail view —
      // every photo just renders with url: null instead of this fetch
      // itself failing.
      console.error("[getPurchaseRequisitionById] attachment signing failed", signError);
    } else {
      for (const entry of signedUrls ?? []) {
        if (entry.path) signedUrlByPath.set(entry.path, entry.signedUrl);
      }
    }
  }

  const lineItems = [...(data.purchase_requisition_line_items ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({
      description: row.description,
      qty: row.qty,
      extra: Object.fromEntries(
        (row.purchase_requisition_line_item_values ?? []).map((value) => [value.column_id, value.value]),
      ),
      attachments: [...(attachmentsByLineItemId.get(row.id) ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((attachment) => ({
          storagePath: attachment.storage_path,
          fileName: attachment.file_name,
          contentType: attachment.content_type,
          sizeBytes: attachment.size_bytes,
          url: signedUrlByPath.get(attachment.storage_path) ?? null,
        })),
    }));

  return {
    id: data.id,
    prNumber: data.pr_number,
    status: data.status,
    priority: data.priority,
    requestedBy: data.requested_by,
    requiredPort: data.required_port,
    remarks: data.remarks,
    requisitionNumber: data.requisition_number,
    requisitionDate: data.requisition_date,
    title: data.title,
    equipmentName: data.equipment_name,
    equipmentType: data.equipment_type,
    equipmentMake: data.equipment_make,
    equipmentSerialNo: data.equipment_serial_no,
    equipmentModel: data.equipment_model,
    equipmentSpecifications: data.equipment_specifications,
    equipmentOtherDetails: data.equipment_other_details,
    dropdowns,
    customFields,
    columns,
    lineItems,
  };
}

// Used only by the DELETE route to clean up Storage objects the DB's own
// on-delete-cascade can't reach (cascade only removes the metadata rows in
// purchase_requisition_line_item_attachments, never the physical Storage
// blob each row points at). Must be called BEFORE delete_purchase_requisition
// runs, since that RPC's cascade deletes the only rows these paths live in.
export async function getPurchaseRequisitionAttachmentPaths(id: string): Promise<string[]> {
  const supabase = await createClient();
  // Flat query, inner-joined up to the owning requisition — same shape (and
  // same PostgREST nested-embed pitfall) as getPurchaseRequisitionById above.
  const { data, error } = await supabase
    .from("purchase_requisition_line_item_attachments")
    .select("storage_path, purchase_requisition_line_items!inner(requisition_id)")
    .eq("purchase_requisition_line_items.requisition_id", id);

  if (error) throw error;
  return (data ?? []).map((row) => row.storage_path);
}
