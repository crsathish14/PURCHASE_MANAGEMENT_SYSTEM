// Page-size vocabulary for the vendor quote form's line items, shared by the
// form's pager and the API route that validates the requested size.
export const QUOTE_LINE_ITEM_PAGE_SIZES = [10, 25, 50] as const;
export const QUOTE_LINE_ITEM_DEFAULT_PAGE_SIZE = 25;

export function isQuoteLineItemPageSize(value: number): boolean {
  return (QUOTE_LINE_ITEM_PAGE_SIZES as readonly number[]).includes(value);
}
