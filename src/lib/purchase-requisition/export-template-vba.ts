import type ExcelJS from "exceljs";

import { PR_CATEGORY, PR_LINE_ITEM_PRESET_COLUMN } from "@/lib/constants/purchase-requisition";
import { getPresetColumnsForCategory } from "@/lib/purchase-requisition/preset-columns";
import { LABEL, findLineItemColumns } from "./import-template-vba";
import { buildMergeMap, findLabelCell, findLineItemHeaderRow, getMergeRowSpan } from "./import-template-vba-shared";
import {
  expandLineItemRows,
  findLineItemPhotosColumn,
  resolveExtraValue,
  writeLabeledDateValue,
  writeLabeledValue,
  type ExportRequisitionData,
} from "./export-template-vba-shared";

const presetColumns = getPresetColumnsForCategory(PR_CATEGORY.STORES);

// Write-side mirror of import-template-vba.ts, targeting the exact same
// cells that file's own LABEL/findLineItemColumns already identify on the
// read side — see export-template-vba-shared.ts's module comment for why
// this reuses rather than re-derives them. Approved Qty (no cell in this
// template at all) is written into the repurposed Supporting Photos column,
// since photos are out of scope for this feature — see
// findLineItemPhotosColumn's own comment.
export function fillStoresVbaRequisitionTemplate(sheet: ExcelJS.Worksheet, data: ExportRequisitionData): void {
  const mergeMap = buildMergeMap(sheet);

  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, "vessel name"), data.vesselName);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.imoNo), data.vesselImoNo);
  writeLabeledDateValue(sheet, mergeMap, findLabelCell(sheet, LABEL.date), data.requisitionDate);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.requisitionNo), data.requisitionNumber);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.supplyPort), data.requiredPort);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.title), data.title);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.requisitionedBy), data.requisitionedBy);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.captainChiefEngineer), data.captainChiefEngineer);

  const headerRow = findLineItemHeaderRow(sheet);
  if (headerRow === null) return;

  const columnMap = findLineItemColumns(sheet, headerRow);
  const slNoCol = columnMap.get("slNo");
  if (slNoCol === undefined) return;

  const approvedQtyCol = findLineItemPhotosColumn(sheet, headerRow);
  if (approvedQtyCol !== undefined) {
    sheet.getRow(headerRow).getCell(approvedQtyCol).value = "Approved Qty";
  }

  const headerRowSpan = getMergeRowSpan(mergeMap, headerRow, slNoCol);
  const firstDataRow = expandLineItemRows(sheet, headerRow, headerRowSpan, data.lineItems.length);

  data.lineItems.forEach((item, index) => {
    const row = sheet.getRow(firstDataRow + index);
    row.getCell(slNoCol).value = index + 1;

    const descriptionCol = columnMap.get("description");
    if (descriptionCol !== undefined) row.getCell(descriptionCol).value = item.description;

    const qtyCol = columnMap.get("qty");
    if (qtyCol !== undefined) row.getCell(qtyCol).value = item.qty;

    for (const key of [
      PR_LINE_ITEM_PRESET_COLUMN.IMPA_CODE,
      PR_LINE_ITEM_PRESET_COLUMN.UOM,
      PR_LINE_ITEM_PRESET_COLUMN.ROB,
      PR_LINE_ITEM_PRESET_COLUMN.REMARKS,
    ]) {
      const col = columnMap.get(key);
      if (col === undefined) continue;
      row.getCell(col).value = resolveExtraValue(data.columns, presetColumns, key, item.extra);
    }

    if (approvedQtyCol !== undefined) {
      row.getCell(approvedQtyCol).value = resolveExtraValue(
        data.columns,
        presetColumns,
        PR_LINE_ITEM_PRESET_COLUMN.APPROVED_QTY,
        item.extra,
      );
    }
  });
}
