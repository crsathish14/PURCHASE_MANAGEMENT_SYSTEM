import type { QuoteComparisonLineItem, QuoteComparisonVendor } from "@/lib/data/rfq-quote-comparison";

export type PurchaseOrderQuantityEditor = {
  quantities: Record<string, string>;
  sameAsQuoteQty: boolean;
  validationAttempted: boolean;
  disabled?: boolean;
  onSameAsQuoteQtyChange: (checked: boolean) => void;
  onQuantityChange: (quotationItemId: string, value: string) => void;
};

export function getNeededPoQty(editor: PurchaseOrderQuantityEditor | undefined, item: QuoteComparisonLineItem) {
  if (!editor) return item.approvedQty ?? "";
  return editor.quantities[item.quotationItemId] ?? item.neededPoQty ?? item.approvedQty ?? "";
}

export function isValidNeededPoQty(value: string): boolean {
  if (value.trim() === "") return false;
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity >= 0;
}

export function getNeededPoLineTotal(
  editor: PurchaseOrderQuantityEditor | undefined,
  item: QuoteComparisonLineItem,
): number | null {
  if (!editor) return item.totalPrice;
  const quantityText = getNeededPoQty(editor, item);
  if (!isValidNeededPoQty(quantityText) || item.unitPrice === null) return null;
  const total = item.unitPrice * Number(quantityText);
  return Number.isFinite(total) ? total : null;
}

export function getPurchaseOrderAmount(
  editor: PurchaseOrderQuantityEditor | undefined,
  vendor: QuoteComparisonVendor,
): number | null {
  if (!editor) return vendor.totalQuotedAmount;
  const lineTotals = vendor.lineItems.map((item) => getNeededPoLineTotal(editor, item));
  if (lineTotals.some((amount) => amount === null)) return null;
  const total = lineTotals.reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
  return Number.isFinite(total) ? total : null;
}
