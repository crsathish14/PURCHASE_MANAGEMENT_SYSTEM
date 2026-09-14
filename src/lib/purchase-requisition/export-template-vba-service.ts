import type ExcelJS from "exceljs";

import { PR_CATEGORY, PR_LINE_ITEM_PRESET_COLUMN } from "@/lib/constants/purchase-requisition";
import { getPresetColumnsForCategory } from "@/lib/purchase-requisition/preset-columns";
import { LABEL, findLineItemColumns } from "./import-template-vba-service";
import { buildMergeMap, findLabelCell, findLineItemHeaderRow, getMergeRowSpan } from "./import-template-vba-shared";
import {
  expandLineItemRows,
  resolveExtraValue,
  writeLabeledDateValue,
  writeLabeledValue,
  type ExportRequisitionData,
} from "./export-template-vba-shared";

const presetColumns = getPresetColumnsForCategory(PR_CATEGORY.SERVICE);

// Write-side mirror of import-template-vba-service.ts — see
// export-template-vba.ts (Stores) for the shared reasoning. Service has no
// Qty/UOM/ROB/Part No./Approved Qty concept at all (a service isn't
// quantified the way a stores/spares part is), so unlike the other two
// categories this never touches the line-items table's own Supporting
// Photos column — there's no Approved Qty data to repurpose it for, and it's
// left exactly as shipped (blank).
export function fillServiceVbaRequisitionTemplate(sheet: ExcelJS.Worksheet, data: ExportRequisitionData): void {
  const mergeMap = buildMergeMap(sheet);

  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, "vessel name"), data.vesselName);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.imoNo), data.vesselImoNo);
  writeLabeledDateValue(sheet, mergeMap, findLabelCell(sheet, LABEL.date), data.requisitionDate);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.requisitionNo), data.requisitionNumber);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.servicePort), data.requiredPort);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.title), data.title);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.equipmentName), data.equipmentName);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.equipmentType), data.equipmentType);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.equipmentMake), data.equipmentMake);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.equipmentSerialNo), data.equipmentSerialNo);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.equipmentModel), data.equipmentModel);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.equipmentSpecifications), data.equipmentSpecifications);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.equipmentOtherDetails), data.equipmentOtherDetails);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.requisitionedBy), data.requisitionedBy);
  writeLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.captainChiefEngineer), data.captainChiefEngineer);

  const headerRow = findLineItemHeaderRow(sheet);
  if (headerRow === null) return;

  const columnMap = findLineItemColumns(sheet, headerRow);
  const slNoCol = columnMap.get("slNo");
  if (slNoCol === undefined) return;

  const headerRowSpan = getMergeRowSpan(mergeMap, headerRow, slNoCol);
  const firstDataRow = expandLineItemRows(sheet, headerRow, headerRowSpan, data.lineItems.length);

  data.lineItems.forEach((item, index) => {
    const row = sheet.getRow(firstDataRow + index);
    row.getCell(slNoCol).value = index + 1;

    const descriptionCol = columnMap.get("description");
    if (descriptionCol !== undefined) row.getCell(descriptionCol).value = item.description;

    for (const key of [PR_LINE_ITEM_PRESET_COLUMN.AVAILABLE_ONBOARD, PR_LINE_ITEM_PRESET_COLUMN.REMARKS]) {
      const col = columnMap.get(key);
      if (col === undefined) continue;
      row.getCell(col).value = resolveExtraValue(data.columns, presetColumns, key, item.extra);
    }
  });
}
