import type { Metadata } from "next";

import en from "@/locales/en.json";
import { getPrDropdownFields } from "@/lib/data/purchase-requisition";
import { getRequestedQuotes } from "@/lib/data/requested-quotes";
import { requireActiveUser } from "@/lib/supabase/require-active-user";
import { RequestedQuoteView } from "@/components/rfq/requested-quote-view";

const t = en.staff.requestedQuote;
const DEFAULT_PAGE_SIZE = 20;

export const metadata: Metadata = {
  title: `${t.title} — ${en.auth.brand.word}`,
};

export default async function RequestedQuotePage() {
  // Re-verify here even though (staff)/layout.tsx already checks — see the
  // comment on requireActiveUser(): a layout's redirect() doesn't stop this
  // page's own render.
  await requireActiveUser();
  const [dropdownFields, { rows, total }] = await Promise.all([
    getPrDropdownFields(),
    getRequestedQuotes({ page: 1, pageSize: DEFAULT_PAGE_SIZE }),
  ]);

  return <RequestedQuoteView initialDropdownFields={dropdownFields} initialRows={rows} initialTotal={total} />;
}
