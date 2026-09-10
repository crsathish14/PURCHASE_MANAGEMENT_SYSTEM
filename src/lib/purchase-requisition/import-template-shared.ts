import type ExcelJS from "exceljs";

import type { PrCategory } from "@/lib/constants/purchase-requisition";
import type { PrDropdownField } from "@/lib/data/purchase-requisition";
import type { CreateRequisitionFormValues } from "@/lib/validation/purchase-requisition";

export type ParsedImportResult = {
  category: PrCategory;
  fileName: string;
  values: Partial<CreateRequisitionFormValues>;
  warnings: string[];
  // VBA-format only (see import-template-vba.ts): raw photo bytes extracted
  // from the workbook's embedded images, keyed by the index of the line item
  // in `values.lineItems` they belong to. These still need to go through the
  // real sign+upload pipeline (po-requests-view.tsx) before they become real
  // `attachments[]` entries — always absent for the legacy ExcelJS-generated
  // template, which never embeds images.
  pendingLineItemPhotos?: Map<number, { blob: Blob; fileName: string }[]>;
};

export type ParseImportError = { error: string };

export function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return "";
  const value = cell.value;
  if (value == null) return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return cell.text?.trim() ?? String(value).trim();
}

export function matchDropdownOption(field: PrDropdownField | undefined, typed: string): string {
  if (!field || !typed) return "";
  const match = field.options.find((option) => option.label.toLowerCase() === typed.toLowerCase());
  return match?.value ?? "";
}
