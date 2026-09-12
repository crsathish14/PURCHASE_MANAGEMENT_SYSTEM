import type ExcelJS from "exceljs";

import { cellText } from "./import-template-shared";
import { normalize, type CellLocation, type MergeSpan } from "./import-template-vba-shared";

// Write-side mirror of import-template-vba-shared.ts's read helpers — reuses
// its merge-aware label lookup (buildMergeMap/findLabelCell/
// getMergeRowSpan/findLineItemHeaderRow, imported directly by each category's
// export-template-vba*.ts writer) rather than hardcoded cell addresses, for
// the same reason the read side avoids them: the Stores template alone has
// already been revised twice, and a hardcoded offset silently breaks the
// moment that happens again.

// Mirrors readLabeledValue exactly, write instead of read: the value cell is
// never simply "one cell to the right" of the label, since the label itself
// can be a multi-column merge — it's one column past the END of that merge.
// Silently no-ops on a missing label (mirrors readLabeledValue returning ""
// for the same case) rather than throwing — a label this code itself doesn't
// find is a bug to catch in testing against the real templates, not a
// runtime failure that should take down the whole export.
export function writeLabeledValue(
  sheet: ExcelJS.Worksheet,
  mergeMap: Map<string, MergeSpan>,
  loc: CellLocation | null,
  value: string,
): void {
  if (!loc) return;
  const span = mergeMap.get(`${loc.row}:${loc.col}`);
  const labelEndCol = span?.right ?? loc.col;
  sheet.getRow(loc.row).getCell(labelEndCol + 1).value = value;
}

// Same cell-resolution as writeLabeledValue, but writes a real Date so the
// cell's own already-set date number format (from the loaded template)
// renders it correctly — mirrors readDateValue's Excel-serial-number
// handling, in reverse.
export function writeLabeledDateValue(
  sheet: ExcelJS.Worksheet,
  mergeMap: Map<string, MergeSpan>,
  loc: CellLocation | null,
  value: Date | null,
): void {
  if (!loc || !value) return;
  const span = mergeMap.get(`${loc.row}:${loc.col}`);
  const labelEndCol = span?.right ?? loc.col;
  sheet.getRow(loc.row).getCell(labelEndCol + 1).value = value;
}

// Every template ships exactly 1 pre-formatted line-item row. For `count`
// line items, clones that row `count - 1` more times via ExcelJS's own
// duplicateRow (copies row height/style + per-cell style from the source
// row, then splices the copies in immediately below it — shifting the
// SUPPORTING PHOTOS banner/header and the sign-off footer down accordingly,
// since they're plain rows further down the same sheet, not merged across
// the insertion point). Returns the row number of the first data row.
export function expandLineItemRows(
  sheet: ExcelJS.Worksheet,
  headerRow: number,
  headerRowSpan: number,
  count: number,
): number {
  const firstDataRow = headerRow + headerRowSpan;
  if (count > 1) sheet.duplicateRow(firstDataRow, count - 1, true);
  return firstDataRow;
}

// Locates the line-items table's own "Supporting Photos" column, searched
// only within that table's own header row (never a full-sheet search) — this
// is genuinely unambiguous here, unlike the SUPPORTING PHOTOS *table*
// heading further down the sheet, which needs findLabelCellInColumn's
// column-restricted search specifically to avoid this exact same string.
// Stores and Spares both repurpose this column for Approved Qty (see each
// export-template-vba*.ts writer) since photos are out of scope for export
// and Approved Qty otherwise has no cell anywhere in either template.
export function findLineItemPhotosColumn(sheet: ExcelJS.Worksheet, headerRow: number): number | undefined {
  let col: number | undefined;
  sheet.getRow(headerRow).eachCell((cell, colNumber) => {
    if (col === undefined && normalize(cellText(cell)) === "supporting photos") col = colNumber;
  });
  return col;
}

// A saved PR's line-item columns carry only a free-text label (no stable key
// persisted in the DB — update_purchase_requisition deletes+reinserts every
// column on every save) — the only reliable way to find "the office's
// Approved Qty/UOM/ROB/etc. column" is by exact label-equality against
// getPresetColumnsForCategory's own labels, the same precedent
// line-items-field.tsx already relies on client-side. Returns "" for a
// preset the category doesn't have, a preset that was somehow removed from
// this PR's own columns, or a line item missing that key entirely.
export function resolveExtraValue(
  prColumns: Array<{ key: string; label: string }>,
  presetColumns: Array<{ key: string; label: string }>,
  presetKey: string,
  extra: Record<string, string>,
): string {
  const preset = presetColumns.find((column) => column.key === presetKey);
  if (!preset) return "";
  const saved = prColumns.find((column) => column.label === preset.label);
  return saved ? (extra[saved.key] ?? "") : "";
}

export type ExportLineItem = {
  description: string;
  qty: string;
  extra: Record<string, string>;
};

// Assembled once per export request (in the API route) from
// getPurchaseRequisitionById's own PrDetail, plus the vessel name/IMO No.
// resolved separately (PrDetail only ever carries the raw vessel dropdown
// slug, never the label or IMO). Deliberately flat and category-agnostic —
// each export-template-vba*.ts writer picks only the fields its own category
// actually has a cell for.
export type ExportRequisitionData = {
  vesselName: string;
  vesselImoNo: string;
  requisitionDate: Date | null;
  requisitionNumber: string;
  requiredPort: string;
  title: string;
  requisitionedBy: string;
  captainChiefEngineer: string;
  equipmentName: string;
  equipmentType: string;
  equipmentMake: string;
  equipmentSerialNo: string;
  equipmentModel: string;
  equipmentSpecifications: string;
  equipmentOtherDetails: string;
  columns: Array<{ key: string; label: string }>;
  lineItems: ExportLineItem[];
};
