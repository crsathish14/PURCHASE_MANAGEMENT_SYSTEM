import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { QuoteDraftHeader, QuoteDraftState } from "@/lib/vendor-quote/draft";

const headerSchema = z.record(z.string(), z.string());

// The vendor's auto-saved header values and last-saved time, for the
// unauthenticated /quote/[token] page. (Their line item entries arrive with
// each line item page — see getRfqQuoteLineItemsPage.) The RPC already returns
// nothing for an unknown, expired or submitted link. A draft that is missing
// or unreadable is "no draft" — a broken draft must never stop the vendor from
// opening a blank form.
export async function getRfqQuoteDraftByToken(token: string): Promise<QuoteDraftState | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_rfq_quote_draft", { p_token: token }).maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const header = headerSchema.safeParse(data.header);
    return { header: header.success ? header.data : {}, savedAt: data.saved_at };
  } catch (error) {
    console.error("[getRfqQuoteDraftByToken]", error);
    return null;
  }
}

export type RfqQuoteSubmission = {
  header: QuoteDraftHeader;
  // Every line item, in order; fields/photos are empty for an untouched row.
  items: Array<{ lineItemId: string; fields: Record<string, string>; photos: unknown[] }>;
};

const submissionItemSchema = z.object({
  lineItemId: z.string(),
  fields: z.record(z.string(), z.string()),
  photos: z.array(z.unknown()),
});

// What the submit route validates and persists: the saved header plus every
// line item with its saved entries. The form only ever holds one page of line
// items, so the full quote is assembled here, server-side, from the draft.
// Returns null for an unknown, expired or already-submitted link.
export async function getRfqQuoteSubmissionByToken(token: string): Promise<RfqQuoteSubmission | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_rfq_quote_submission_by_token", { p_token: token }).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const header = headerSchema.safeParse(data.header);
  const items = z.array(submissionItemSchema).safeParse(data.items);
  if (!items.success) throw new Error("Stored quote draft is unreadable");

  return { header: header.success ? header.data : {}, items: items.data };
}
