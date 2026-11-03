import {
  DELIVERY_NOTE_CANDIDATE_SORT,
  DELIVERY_NOTE_URGENCY,
  isDeliveryNoteUrgency,
  type DeliveryNoteCandidateSort,
  type DeliveryNoteUrgency,
} from "@/lib/constants/delivery-note";
import type { DatePreset } from "@/lib/constants/purchase-requisition";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

export type DeliveryNoteFile = {
  id: string;
  originalFilename: string;
  createdAt: string;
};

export type DeliveryNoteListRow = {
  id: string;
  prNumber: string;
  requisitionNumber: string | null;
  title: string | null;
  vesselLabel: string | null;
  categoryLabel: string | null;
  vendorName: string | null;
  noteCount: number;
  lastUploadedAt: string;
  notes: DeliveryNoteFile[];
};

export type DeliveryNoteCandidateRow = {
  id: string;
  prNumber: string;
  requisitionNumber: string | null;
  title: string | null;
  vesselLabel: string | null;
  categoryLabel: string | null;
  vendorName: string | null;
  urgency: DeliveryNoteUrgency;
};

export type DeliveryNoteFilters = {
  search?: string;
  vessels?: string[];
  categories?: string[];
  datePreset?: DatePreset;
  startDate?: string;
  endDate?: string;
};

// Awarded requisitions with a received proforma invoice and no delivery note
// yet — the "Add delivery or service note" picker. Filtered, sorted and paged
// server-side; each row carries its urgency (danger / warning / normal).
export async function getDeliveryNoteCandidates({
  page,
  pageSize,
  search,
  urgencies,
  sort,
}: {
  page: number;
  pageSize: number;
  search?: string;
  urgencies?: DeliveryNoteUrgency[];
  sort?: DeliveryNoteCandidateSort;
}): Promise<{ rows: DeliveryNoteCandidateRow[]; total: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_delivery_note_candidates", {
    p_search: search?.trim() ? search.trim() : null,
    p_urgencies: urgencies?.length ? urgencies : null,
    p_sort: sort ?? DELIVERY_NOTE_CANDIDATE_SORT.DEFAULT,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) throw error;

  const rows: DeliveryNoteCandidateRow[] = (data ?? []).map((row) => ({
    id: row.id,
    prNumber: row.pr_number,
    requisitionNumber: row.requisition_number,
    title: row.pr_title,
    vesselLabel: row.vessel_label,
    categoryLabel: row.category_label,
    vendorName: row.vendor_name,
    urgency: isDeliveryNoteUrgency(row.urgency) ? row.urgency : DELIVERY_NOTE_URGENCY.NORMAL,
  }));

  return { rows, total: data?.[0]?.total_count ?? 0 };
}

// Requisitions that have at least one delivery note, each with its notes.
export async function getDeliveryNotes({
  page,
  pageSize,
  search,
  vessels,
  categories,
  datePreset,
  startDate,
  endDate,
}: {
  page: number;
  pageSize: number;
} & DeliveryNoteFilters): Promise<{ rows: DeliveryNoteListRow[]; total: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_delivery_notes", {
    p_search: search?.trim() ? search.trim() : null,
    p_vessels: vessels?.length ? vessels : null,
    p_categories: categories?.length ? categories : null,
    p_date_preset: datePreset ?? null,
    p_start_date: startDate ?? null,
    p_end_date: endDate ?? null,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) throw error;

  const rows: DeliveryNoteListRow[] = (data ?? []).map((row) => ({
    id: row.id,
    prNumber: row.pr_number,
    requisitionNumber: row.requisition_number,
    title: row.pr_title,
    vesselLabel: row.vessel_label,
    categoryLabel: row.category_label,
    vendorName: row.vendor_name,
    noteCount: row.note_count,
    lastUploadedAt: row.last_uploaded_at,
    notes: (Array.isArray(row.notes) ? (row.notes as Json[]) : []).map((note) => note as unknown as DeliveryNoteFile),
  }));

  return { rows, total: data?.[0]?.total_count ?? 0 };
}

export async function countDeliveryNotes(requisitionId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("delivery_notes")
    .select("id", { count: "exact", head: true })
    .eq("requisition_id", requisitionId);

  if (error) throw error;
  return count ?? 0;
}

export async function getDeliveryNoteById(
  noteId: string,
): Promise<{ id: string; requisitionId: string; storagePath: string; originalFilename: string; createdAt: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delivery_notes")
    .select("id, requisition_id, storage_path, original_filename, created_at")
    .eq("id", noteId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    requisitionId: data.requisition_id,
    storagePath: data.storage_path,
    originalFilename: data.original_filename,
    createdAt: data.created_at,
  };
}
