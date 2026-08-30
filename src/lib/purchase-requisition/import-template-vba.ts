import type ExcelJS from "exceljs";

import { PR_CATEGORY, PR_LINE_ITEM_PRESET_COLUMN } from "@/lib/constants/purchase-requisition";
import type { PrDropdownField } from "@/lib/data/purchase-requisition";
import type { Vessel } from "@/lib/data/vessels";
import { getPresetColumnsForCategory } from "@/lib/purchase-requisition/preset-columns";
import type { CreateRequisitionFormValues } from "@/lib/validation/purchase-requisition";
import { cellText, matchDropdownOption, type ParsedImportResult } from "./import-template-shared";
import {
  buildImagePositionMap,
  buildMergeMap,
  excelImageToBlob,
  findImageTable,
  findLabelCell,
  findLineItemHeaderRow,
  gatherPhotosBySlNo,
  isSlNoLabel,
  normalize,
  parseLineItemRows,
  readDateValue,
  readLabeledValue,
  type MergeSpan,
} from "./import-template-vba-shared";

export { isVbaRequisitionSheet } from "./import-template-vba-shared";

// This template's own text is baked into the static .xlsm at authoring time
// (see templates/vba-source/stores/) — unlike the legacy ExcelJS-generated
// template, none of it comes from en.json, so these are hardcoded literals
// local to this file, matched case-insensitively (see normalize() in
// import-template-vba-shared.ts, shared with the Spares VBA parser). Kept in
// sync with the "v2" layout (templates/vba-source/stores/Requisition_Form_Setup_Guide.md)
// — sheet renamed, Supply Port added, UOM split into its own column, and the
// photo table widened to 7 slots. v1 files (the sheet named "Requisition
// Form") are no longer recognized; this is a full replacement, not a
// dual-format dispatch, since the paper form itself was revised.
const LABEL = {
  imoNo: "imo no",
  date: "date",
  requisitionNo: "requisition no",
  supplyPort: "supply port",
  title: "title",
  impaCode: "impa/issa code",
  uom: "uom",
  qty: "qty requested",
  rob: "rob",
  remarks: "remarks",
  requisitionedBy: "requisitioned by: (name&rank)",
  captainChiefEngineer: "approved by: (name&rank)",
};

function findLineItemColumns(sheet: ExcelJS.Worksheet, headerRow: number): Map<string, number> {
  const map = new Map<string, number>();
  // first-match-wins: several of these headers are themselves multi-column
  // merges (e.g. "Description" spans C:D), and ExcelJS's merge-cell reads
  // make every cell in a merge report the master cell's text — so eachCell
  // visits this same label more than once per header. Only the master
  // (leftmost) column is recorded; letting a later merge-child overwrite it
  // would still read the correct VALUE (merge reads are also proxied), but
  // findImageTable relies on this same first-match-wins convention for its
  // slot columns, where only the master column is where an image is ever
  // actually anchored — kept consistent here rather than relying on
  // merge-read proxying to paper over the difference.
  sheet.getRow(headerRow).eachCell((cell, colNumber) => {
    const norm = normalize(cellText(cell));
    let key: string | null = null;
    if (isSlNoLabel(norm)) key = "slNo";
    else if (norm === "description") key = "description";
    else if (norm === LABEL.qty) key = "qty";
    else if (norm === LABEL.impaCode) key = PR_LINE_ITEM_PRESET_COLUMN.IMPA_CODE;
    else if (norm === LABEL.uom) key = PR_LINE_ITEM_PRESET_COLUMN.UOM;
    else if (norm === LABEL.rob) key = PR_LINE_ITEM_PRESET_COLUMN.ROB;
    else if (norm === LABEL.remarks) key = PR_LINE_ITEM_PRESET_COLUMN.REMARKS;
    if (key && !map.has(key)) map.set(key, colNumber);
  });
  return map;
}

export function parseVbaRequisitionTemplate(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  dropdownFields: PrDropdownField[],
  vessels: Vessel[],
  fileName: string,
): ParsedImportResult {
  const warnings: string[] = [];
  const mergeMap: Map<string, MergeSpan> = buildMergeMap(sheet);

  const vesselField = dropdownFields.find((field) => field.key === "vessel");
  const imoTyped = readLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.imoNo));
  let vesselValue = "";
  if (imoTyped) {
    const matchedVessel = vessels.find((vessel) => vessel.imoNo.trim() === imoTyped.trim());
    if (!matchedVessel) {
      warnings.push(`IMO No "${imoTyped}" wasn't recognized — choose the vessel manually.`);
    } else {
      vesselValue = matchDropdownOption(vesselField, matchedVessel.name);
      if (!vesselValue) {
        warnings.push(`Vessel "${matchedVessel.name}" wasn't recognized in the vessel list — choose it manually.`);
      }
    }
  }

  const dropdowns: Record<string, string> = Object.fromEntries(dropdownFields.map((field) => [field.key, ""]));
  if (vesselValue) dropdowns.vessel = vesselValue;
  dropdowns.category = PR_CATEGORY.STORES;

  const columns = getPresetColumnsForCategory(PR_CATEGORY.STORES);
  const headerRow = findLineItemHeaderRow(sheet);

  const lineItems: CreateRequisitionFormValues["lineItems"] = [];
  const pendingLineItemPhotos = new Map<number, { blob: Blob; fileName: string }[]>();

  if (headerRow !== null) {
    const columnMap = findLineItemColumns(sheet, headerRow);
    const rows = parseLineItemRows(sheet, mergeMap, headerRow, columnMap, columns);

    const imageTable = findImageTable(sheet, mergeMap);
    const photosBySlNo = imageTable
      ? gatherPhotosBySlNo(sheet, buildImagePositionMap(workbook, sheet), imageTable)
      : new Map<string, ExcelJS.Image[]>();

    rows.forEach((row, index) => {
      lineItems.push({ description: row.description, qty: row.qty, extra: row.extra, attachments: [] });

      const images = photosBySlNo.get(row.slNo) ?? [];
      if (images.length === 0) return;
      // No cap on photos per line item, by design (client requirement) —
      // every image found for this Sl No. is imported.
      const blobs = images
        .map((image, i) => excelImageToBlob(image, i))
        .filter((entry): entry is { blob: Blob; fileName: string } => entry !== null);
      if (blobs.length > 0) pendingLineItemPhotos.set(index, blobs);
    });
  }

  if (lineItems.length === 0) {
    lineItems.push({
      description: "",
      qty: "",
      extra: Object.fromEntries(columns.map((c) => [c.key, ""])),
      attachments: [],
    });
  }

  const values: Partial<CreateRequisitionFormValues> = {
    priority: "",
    dropdowns,
    requestedBy: "",
    requiredPort: readLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.supplyPort)),
    requisitionNumber: readLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.requisitionNo)),
    requisitionDate: readDateValue(sheet, mergeMap, findLabelCell(sheet, LABEL.date)),
    title: readLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.title)),
    remarks: "",
    equipmentName: "",
    equipmentType: "",
    equipmentMake: "",
    equipmentSerialNo: "",
    equipmentModel: "",
    equipmentSpecifications: "",
    equipmentOtherDetails: "",
    requisitionedBy: readLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.requisitionedBy)),
    captainChiefEngineer: readLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.captainChiefEngineer)),
    customFields: [],
    columns,
    lineItems,
  };

  return {
    category: PR_CATEGORY.STORES,
    fileName,
    values,
    warnings,
    pendingLineItemPhotos: pendingLineItemPhotos.size > 0 ? pendingLineItemPhotos : undefined,
  };
}
