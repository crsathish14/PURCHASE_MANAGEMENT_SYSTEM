import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET, SIGNED_DISPLAY_URL_TTL_SECONDS } from "@/lib/constants/storage";
import {
  isOwnPhotoPath,
  quoteDraftItemEntrySchema,
  type QuoteDraftPhoto,
} from "@/lib/vendor-quote/draft";

export type RfqQuoteLineItemAttachment = {
  fileName: string;
  contentType: string;
  url: string | null;
};

// A photo the vendor already uploaded for a line item, with a signed display
// URL (empty if signing failed — the upload itself is still intact).
export type RfqQuoteDraftPhoto = QuoteDraftPhoto & { previewUrl: string };

export type RfqQuoteLineItemDraft = {
  fields: Record<string, string>;
  photos: RfqQuoteDraftPhoto[];
};

export type RfqQuoteLineItem = {
  lineItemId: string;
  description: string;
  columns: Array<{ label: string; value: string }>;
  attachments: RfqQuoteLineItemAttachment[];
  // The vendor's saved entries for this row, if they've started it.
  draft: RfqQuoteLineItemDraft | null;
};

// The quote's header: everything except the line items, which are loaded a
// page at a time (see getRfqQuoteLineItemsPage) because a quote can have
// hundreds of them.
export type RfqQuoteDetail = {
  requisitionId: string;
  prNumber: string;
  vendorName: string;
  vendorEmail: string;
  expiresAt: string;
  submittedAt: string | null;
  isExpired: boolean;
  category: string | null;
  requisitionDate: string | null;
  requestedBy: string | null;
  requiredPort: string | null;
  vesselLabel: string | null;
  vesselImoNo: string | null;
  // Spares/Service only — Stores PRs never populate these (see
  // create-requisition-dialog.tsx's Equipment Details section), so they're
  // always null for a Stores quote and simply unused by StoresQuoteForm.
  equipmentName: string | null;
  equipmentType: string | null;
  equipmentMake: string | null;
  equipmentSerialNo: string | null;
  equipmentModel: string | null;
  equipmentSpecifications: string | null;
  equipmentOtherDetails: string | null;
  lineItemCount: number;
};

export type RfqQuoteLineItemsPage = {
  totalCount: number;
  // The draft total of every line item outside this page, so the form's grand
  // total is right while the other pages aren't loaded.
  otherPagesTotal: number;
  lineItems: RfqQuoteLineItem[];
};

type RawLineItem = {
  lineItemId: string;
  description: string;
  columns: Array<{ label: string; value: string }>;
  attachments: Array<{ fileName: string; contentType: string; storagePath: string }>;
  draft: unknown;
};

// Public lookup, called from the unauthenticated /quote/[token] page — the
// quote's header (link/PR identity, equipment fields, line item count). Line
// items come from getRfqQuoteLineItemsPage instead.
export async function getRfqQuoteDetailsByToken(token: string): Promise<RfqQuoteDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_rfq_quote_details_by_token", { p_token: token })
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    requisitionId: data.requisition_id,
    prNumber: data.pr_number,
    vendorName: data.vendor_name,
    vendorEmail: data.vendor_email,
    expiresAt: data.expires_at,
    submittedAt: data.submitted_at,
    isExpired: data.is_expired,
    category: data.category,
    requisitionDate: data.requisition_date,
    requestedBy: data.requested_by,
    requiredPort: data.required_port,
    vesselLabel: data.vessel_label,
    vesselImoNo: data.vessel_imo_no,
    equipmentName: data.equipment_name,
    equipmentType: data.equipment_type,
    equipmentMake: data.equipment_make,
    equipmentSerialNo: data.equipment_serial_no,
    equipmentModel: data.equipment_model,
    equipmentSpecifications: data.equipment_specifications,
    equipmentOtherDetails: data.equipment_other_details,
    lineItemCount: data.line_item_count,
  };
}

// One page of line items, with the vendor's saved entries merged in by the
// database. Returns null for an unknown, expired or already-submitted link.
//
// Only this page's photos are signed: the office's reference photos and the
// vendor's own already-uploaded ones. Signed display URLs can't come from the
// SQL function — createSignedUrls is a Storage-API call, not something plpgsql
// can do — and the vendor has no session for storage.objects' own
// authenticated-only RLS to scope a normal signed-URL call to. This is the
// read-side mirror of the "session-scoped client genuinely can't do the job"
// cases plans/development.md §11 already documents — the admin client is
// used narrowly, only to sign paths the token-validated, requisition-scoped
// RPC call already returned (and, for the vendor's own photos, only paths
// that sit under this token's own upload prefix).
export async function getRfqQuoteLineItemsPage(
  token: string,
  page: number,
  pageSize: number,
): Promise<RfqQuoteLineItemsPage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_rfq_quote_line_items_by_token", {
      p_token: token,
      p_offset: (page - 1) * pageSize,
      p_limit: pageSize,
    })
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const rawLineItems = (data.line_items ?? []) as RawLineItem[];

  // A draft entry that fails validation is dropped, not fatal: a broken draft
  // must never stop the vendor from opening the row.
  const draftByLineItemId = new Map<string, { fields: Record<string, string>; photos: QuoteDraftPhoto[] }>();
  for (const item of rawLineItems) {
    if (!item.draft) continue;
    const parsed = quoteDraftItemEntrySchema.safeParse(item.draft);
    if (!parsed.success) continue;
    draftByLineItemId.set(item.lineItemId, {
      fields: parsed.data.fields ?? {},
      photos: (parsed.data.photos ?? []).filter((photo) => isOwnPhotoPath(token, item.lineItemId, photo.storagePath)),
    });
  }

  const paths = [
    ...rawLineItems.flatMap((item) => item.attachments.map((a) => a.storagePath)),
    ...[...draftByLineItemId.values()].flatMap((entry) => entry.photos.map((photo) => photo.storagePath)),
  ];

  const signedUrlByPath = new Map<string, string | null>();
  if (paths.length > 0) {
    const { data: signedUrls, error: signError } = await createAdminClient()
      .storage.from(STORAGE_BUCKET.ATTACHMENTS)
      .createSignedUrls(paths, SIGNED_DISPLAY_URL_TTL_SECONDS);
    if (signError) {
      console.error("[getRfqQuoteLineItemsPage] photo signing failed", signError);
    } else {
      for (const entry of signedUrls ?? []) {
        if (entry.path) signedUrlByPath.set(entry.path, entry.signedUrl);
      }
    }
  }

  return {
    totalCount: data.total_count,
    otherPagesTotal: Number(data.other_pages_total) || 0,
    lineItems: rawLineItems.map((item) => {
      const draft = draftByLineItemId.get(item.lineItemId);
      return {
        lineItemId: item.lineItemId,
        description: item.description,
        columns: item.columns,
        attachments: item.attachments.map((a) => ({
          fileName: a.fileName,
          contentType: a.contentType,
          url: signedUrlByPath.get(a.storagePath) ?? null,
        })),
        draft: draft
          ? {
              fields: draft.fields,
              photos: draft.photos.map((photo) => ({
                ...photo,
                previewUrl: signedUrlByPath.get(photo.storagePath) ?? "",
              })),
            }
          : null,
      };
    }),
  };
}

// Cheap "does this line item belong to this still-open link" check, for the
// photo-upload signing route.
export async function isRfqQuoteLineItem(token: string, lineItemId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_rfq_quote_line_item", {
    p_token: token,
    p_line_item_id: lineItemId,
  });
  if (error) throw error;
  return data === true;
}
