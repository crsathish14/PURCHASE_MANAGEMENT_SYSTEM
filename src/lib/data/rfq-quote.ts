import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET, SIGNED_DISPLAY_URL_TTL_SECONDS } from "@/lib/constants/storage";

export type RfqQuoteLineItemAttachment = {
  fileName: string;
  contentType: string;
  url: string | null;
};

export type RfqQuoteLineItem = {
  lineItemId: string;
  description: string;
  columns: Array<{ label: string; value: string }>;
  attachments: RfqQuoteLineItemAttachment[];
};

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
  lineItems: RfqQuoteLineItem[];
};

type RawLineItem = {
  lineItemId: string;
  description: string;
  columns: Array<{ label: string; value: string }>;
  attachments: Array<{ fileName: string; contentType: string; storagePath: string }>;
};

// Public lookup, called from the unauthenticated /quote/[token] page for the
// Stores vendor form — a superset of getRfqLinkByToken's own shape (same
// link/PR-identity fields), additionally surfacing the PR header fields and
// every line item (with its dynamic columns and existing photos) the form
// needs to render. A new, additive RPC — get_rfq_link_by_token itself is
// untouched; this is simply what the page calls instead when rendering the
// real form rather than the generic stub.
export async function getRfqQuoteDetailsByToken(token: string): Promise<RfqQuoteDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_rfq_quote_details_by_token", { p_token: token })
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const rawLineItems = (data.line_items ?? []) as RawLineItem[];
  const allStoragePaths = rawLineItems.flatMap((item) => item.attachments.map((a) => a.storagePath));

  // Signed display URLs can't come from the SQL function above —
  // createSignedUrls is a Storage-API call, not something plpgsql can do —
  // and the vendor has no session for storage.objects' own authenticated-only
  // RLS to scope a normal signed-URL call to. This is the read-side mirror of
  // the "session-scoped client genuinely can't do the job" cases
  // plans/development.md §11 already documents (e.g. admin.createUser) — the
  // admin client is used narrowly, only to sign paths the token-validated,
  // requisition-scoped RPC call above already returned, so this request can't
  // be steered into signing any photo outside that one PR.
  const signedUrlByPath = new Map<string, string | null>();
  if (allStoragePaths.length > 0) {
    const { data: signedUrls, error: signError } = await createAdminClient()
      .storage.from(STORAGE_BUCKET.ATTACHMENTS)
      .createSignedUrls(allStoragePaths, SIGNED_DISPLAY_URL_TTL_SECONDS);
    if (signError) {
      console.error("[getRfqQuoteDetailsByToken] attachment signing failed", signError);
    } else {
      for (const entry of signedUrls ?? []) {
        if (entry.path) signedUrlByPath.set(entry.path, entry.signedUrl);
      }
    }
  }

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
    lineItems: rawLineItems.map((item) => ({
      lineItemId: item.lineItemId,
      description: item.description,
      columns: item.columns,
      attachments: item.attachments.map((a) => ({
        fileName: a.fileName,
        contentType: a.contentType,
        url: signedUrlByPath.get(a.storagePath) ?? null,
      })),
    })),
  };
}
