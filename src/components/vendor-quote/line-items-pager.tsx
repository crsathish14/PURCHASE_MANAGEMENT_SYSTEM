"use client";

import { PrPager } from "@/components/purchase-requisition/pr-pager";
import { QUOTE_LINE_ITEM_PAGE_SIZES } from "@/lib/vendor-quote/pagination";
import type { QuoteLineItemPages } from "./use-quote-line-item-pages";

const PAGE_SIZE_OPTIONS = [...QUOTE_LINE_ITEM_PAGE_SIZES];

export type LineItemsPagerProps = {
  pages: QuoteLineItemPages;
};

export function LineItemsPager({ pages }: LineItemsPagerProps) {
  // A short list fits on one page at every size — a pager would only be noise.
  if (pages.totalCount <= PAGE_SIZE_OPTIONS[0]) return null;

  return (
    <div aria-busy={pages.loading} className={`mt-1 ${pages.loading ? "pointer-events-none opacity-60" : ""}`}>
      <PrPager
        page={pages.page}
        pageSize={pages.pageSize}
        total={pages.totalCount}
        onPageChange={(page) => void pages.goToPage(page)}
        onPageSizeChange={(pageSize) => void pages.changePageSize(pageSize)}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </div>
  );
}
