import { createClient } from "@/lib/supabase/server";

export type RfqLinkLookup = {
  requisitionId: string;
  prNumber: string;
  vendorName: string;
  expiresAt: string;
  submittedAt: string | null;
  isExpired: boolean;
};

// Public lookup, called from the unauthenticated /quote/[token] page — goes
// through get_rfq_link_by_token() (security definer) rather than a plain
// .from() select, since purchase_requisition_rfq_links' own RLS is
// authenticated-only. Deliberately .maybeSingle(), not .single(): zero rows
// (unknown token) is an expected, valid outcome here, not an error.
export async function getRfqLinkByToken(token: string): Promise<RfqLinkLookup | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_rfq_link_by_token", { p_token: token }).maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    requisitionId: data.requisition_id,
    prNumber: data.pr_number,
    vendorName: data.vendor_name,
    expiresAt: data.expires_at,
    submittedAt: data.submitted_at,
    isExpired: data.is_expired,
  };
}
