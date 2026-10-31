"use client";

import { useRef, useState } from "react";
import type { FieldValues, UseFormGetValues, UseFormReset } from "react-hook-form";

import en from "@/locales/en.json";
import type { RfqQuoteLineItem, RfqQuoteLineItemsPage } from "@/lib/data/rfq-quote";
import { QUOTE_LINE_ITEM_DEFAULT_PAGE_SIZE } from "@/lib/vendor-quote/pagination";
import { toast } from "@/store/toast-store";
import type { QuoteDraftAutosave } from "./use-quote-draft";

const t = en.vendorQuote.pagination;

// The react-hook-form `items` for one page of line items: each row's blank
// vendor fields overlaid with whatever the vendor already saved for it. Only
// keys the form actually has are taken from the draft, so an entry written
// against an older form shape can't inject a stray field. Photos aren't
// RHF-registered (see vendor-item-photos-field.tsx), so `photos` is always
// the empty placeholder the submit schema's shape needs.
export function buildPageItems<TItem>(
  lineItems: RfqQuoteLineItem[],
  blankFields: Record<string, string>,
): TItem[] {
  return lineItems.map((lineItem) => {
    const item: Record<string, unknown> = { lineItemId: lineItem.lineItemId, photos: [] };
    for (const [key, blank] of Object.entries(blankFields)) {
      item[key] = lineItem.draft?.fields[key] ?? blank;
    }
    return item;
  }) as TItem[];
}

export type QuoteLineItemPages = {
  page: number;
  pageSize: number;
  totalCount: number;
  // Draft total of every line item outside the current page.
  otherPagesTotal: number;
  lineItems: RfqQuoteLineItem[];
  // Zero-based index (in the full list) of the current page's first row.
  start: number;
  loading: boolean;
  // Attach to the section the table lives in; changing page scrolls it back
  // into view so a click on the bottom pager doesn't leave the vendor staring
  // at the end of the next page.
  sectionRef: React.RefObject<HTMLElement | null>;
  goToPage: (page: number) => Promise<boolean>;
  changePageSize: (pageSize: number) => Promise<boolean>;
  // Loads whichever page holds the line item at this zero-based index.
  goToIndex: (index: number) => Promise<boolean>;
};

export type UseQuoteLineItemPagesOptions<T extends FieldValues> = {
  token: string;
  initialPage: RfqQuoteLineItemsPage;
  blankFields: Record<string, string>;
  getValues: UseFormGetValues<T>;
  reset: UseFormReset<T>;
  saveNow: QuoteDraftAutosave["saveNow"];
  runSilently: QuoteDraftAutosave["runSilently"];
  // Called with each newly loaded page, to seed per-row state kept outside
  // the form (photos).
  onLoaded: (lineItems: RfqQuoteLineItem[]) => void;
};

// Server-side pagination of the vendor quote's line items. Only the current
// page exists in the browser: moving to another page first saves the visible
// page's entries to the draft, fetches the next page from the server (each row
// arriving with the vendor's saved entries), and swaps it into the form. The
// header fields stay put. Nothing is lost by leaving a page — the draft holds
// it — and the full quote is assembled and validated on the server at submit.
export function useQuoteLineItemPages<T extends FieldValues>({
  token,
  initialPage,
  blankFields,
  getValues,
  reset,
  saveNow,
  runSilently,
  onLoaded,
}: UseQuoteLineItemPagesOptions<T>): QuoteLineItemPages {
  const [current, setCurrent] = useState({
    page: 1,
    pageSize: QUOTE_LINE_ITEM_DEFAULT_PAGE_SIZE,
    data: initialPage,
  });
  const [loading, setLoading] = useState(false);
  // A ref as well as state: the guard must see a load that started in the same
  // tick, before the state update has re-rendered.
  const loadingRef = useRef(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  async function load(page: number, pageSize: number): Promise<boolean> {
    if (loadingRef.current) return false;
    loadingRef.current = true;
    setLoading(true);
    try {
      // Leaving the page discards the form's copy of its rows, so refuse to
      // go anywhere if they couldn't be saved.
      if (!(await saveNow())) {
        toast.error(t.saveFirst);
        return false;
      }

      const response = await fetch(`/api/quote/${token}/items?page=${page}&pageSize=${pageSize}`);
      const body = await response.json();
      if (!response.ok) {
        toast.error(body?.error?.message ?? t.loadError);
        return false;
      }
      const data = body.data as RfqQuoteLineItemsPage;

      runSilently(() =>
        reset({ ...getValues(), items: buildPageItems(data.lineItems, blankFields) } as unknown as Parameters<
          UseFormReset<T>
        >[0]),
      );
      onLoaded(data.lineItems);
      setCurrent({ page, pageSize, data });
      sectionRef.current?.scrollIntoView({ block: "start" });
      return true;
    } catch {
      toast.error(t.loadError);
      return false;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  return {
    page: current.page,
    pageSize: current.pageSize,
    totalCount: current.data.totalCount,
    otherPagesTotal: current.data.otherPagesTotal,
    lineItems: current.data.lineItems,
    start: (current.page - 1) * current.pageSize,
    loading,
    sectionRef,
    goToPage: (page) => load(page, current.pageSize),
    changePageSize: (pageSize) => load(1, pageSize),
    goToIndex: (index) => load(Math.floor(index / current.pageSize) + 1, current.pageSize),
  };
}
