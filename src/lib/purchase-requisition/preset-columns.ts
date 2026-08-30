import en from "@/locales/en.json";
import { PR_CATEGORY, PR_LINE_ITEM_PRESET_COLUMN } from "@/lib/constants/purchase-requisition";

const t = en.staff.poRequests.createDialog;

export type PresetColumn = { key: string; label: string };

// The single source of truth for which line-item preset columns a given
// category should always have — used both by line-items-field.tsx (manual
// create/edit, auto add/remove on category switch) and by the import-
// template parser (so an imported PR ends up with exactly the same column
// set a manually-created one would, not whatever subset the uploaded file
// happened to contain).
//
// Approved Qty is office-only — filled in during review after RFQ/quotes,
// never known by the ship's crew filling the paper form or its Excel
// template — so it's part of this full set (the column must still exist
// after import, ready to fill) but deliberately excluded from the
// template's own line-item headers in
// src/app/api/purchase-requisitions/import-template/route.ts. ROB
// (Remaining On Board), by contrast, is exactly what the crew records on
// the paper form, so it's both in this set AND importable from the file.
export function getPresetColumnsForCategory(category?: string): PresetColumn[] {
  if (category === PR_CATEGORY.SERVICE) return [];

  const rob: PresetColumn = { key: PR_LINE_ITEM_PRESET_COLUMN.ROB, label: t.columns.rob };
  const approvedQty: PresetColumn = { key: PR_LINE_ITEM_PRESET_COLUMN.APPROVED_QTY, label: t.columns.approvedQty };
  const remarks: PresetColumn = { key: PR_LINE_ITEM_PRESET_COLUMN.REMARKS, label: t.columns.lineItemRemarks };

  if (category === PR_CATEGORY.STORES) {
    return [
      { key: PR_LINE_ITEM_PRESET_COLUMN.IMPA_CODE, label: t.columns.impaCode },
      { key: PR_LINE_ITEM_PRESET_COLUMN.UOM, label: t.columns.uom },
      rob,
      approvedQty,
      remarks,
    ];
  }
  if (category === PR_CATEGORY.SPARES) {
    return [
      { key: PR_LINE_ITEM_PRESET_COLUMN.PART_NO, label: t.columns.partNo },
      { key: PR_LINE_ITEM_PRESET_COLUMN.UOM, label: t.columns.uom },
      rob,
      approvedQty,
      remarks,
    ];
  }
  // Undefined/other (before a category is picked) — treated the same as
  // Stores/Spares' shared baseline, matching this form's existing
  // convention elsewhere.
  return [rob, approvedQty, remarks];
}
