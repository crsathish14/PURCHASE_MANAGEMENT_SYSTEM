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

// This is a completely independent VBA workbook/project from the Stores one
// (see templates/vba-source/spares/Spares_Requisition_Setup_Guide.md) — own
// sheet name, own constants module, no shared state — but built from the
// same proven architecture, so this file only holds what's genuinely
// different: this format's own label text, its own line-item column set
// (Part No./Ref.No. instead of IMPA/ISSA Code, plus an Equipment Details
// section the Stores form has no equivalent of), and Spares-specific output
// shaping. Everything generic (merge-aware label lookup, dynamic table
// sizing, photo-anchor extraction) lives in import-template-vba-shared.ts.
// Exported so export-template-vba-spares.ts (the write-side mirror of this
// file) can target the exact same cells/columns instead of re-deriving its
// own copy that could drift out of sync with a future template revision.
export const LABEL = {
  imoNo: "imo no",
  date: "date",
  requisitionNo: "requisition no",
  supplyPort: "supply port",
  title: "title",
  partNo: "part no./ref.no.",
  uom: "uom",
  qty: "qty requested",
  rob: "rob",
  remarks: "remarks",
  requisitionedBy: "requisitioned by: (name&rank)",
  captainChiefEngineer: "approved by: (name&rank)",
  equipmentName: "name of equipment",
  equipmentType: "type",
  equipmentMake: "make",
  equipmentSerialNo: "sr. no.",
  equipmentModel: "model",
  equipmentSpecifications: "specifications",
  equipmentOtherDetails: "any other details",
};

export function findLineItemColumns(sheet: ExcelJS.Worksheet, headerRow: number): Map<string, number> {
  const map = new Map<string, number>();
  // first-match-wins — see the Stores parser's identical comment on
  // findLineItemColumns for why (merged multi-column headers make eachCell
  // visit the same label more than once per header row).
  sheet.getRow(headerRow).eachCell((cell, colNumber) => {
    const norm = normalize(cellText(cell));
    let key: string | null = null;
    if (isSlNoLabel(norm)) key = "slNo";
    else if (norm === "description") key = "description";
    else if (norm === LABEL.qty) key = "qty";
    else if (norm === LABEL.partNo) key = PR_LINE_ITEM_PRESET_COLUMN.PART_NO;
    else if (norm === LABEL.uom) key = PR_LINE_ITEM_PRESET_COLUMN.UOM;
    else if (norm === LABEL.rob) key = PR_LINE_ITEM_PRESET_COLUMN.ROB;
    else if (norm === LABEL.remarks) key = PR_LINE_ITEM_PRESET_COLUMN.REMARKS;
    if (key && !map.has(key)) map.set(key, colNumber);
  });
  return map;
}

export function parseSparesVbaRequisitionTemplate(
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
  dropdowns.category = PR_CATEGORY.SPARES;

  const columns = getPresetColumnsForCategory(PR_CATEGORY.SPARES);
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
      // No cap on photos per line item, by design (client requirement,
      // matching the Stores format) — every image found for this Sl No. is
      // imported.
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
    equipmentName: readLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.equipmentName)),
    equipmentType: readLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.equipmentType)),
    equipmentMake: readLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.equipmentMake)),
    equipmentSerialNo: readLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.equipmentSerialNo)),
    equipmentModel: readLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.equipmentModel)),
    equipmentSpecifications: readLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.equipmentSpecifications)),
    equipmentOtherDetails: readLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.equipmentOtherDetails)),
    requisitionedBy: readLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.requisitionedBy)),
    captainChiefEngineer: readLabeledValue(sheet, mergeMap, findLabelCell(sheet, LABEL.captainChiefEngineer)),
    customFields: [],
    columns,
    lineItems,
  };

  return {
    category: PR_CATEGORY.SPARES,
    fileName,
    values,
    warnings,
    pendingLineItemPhotos: pendingLineItemPhotos.size > 0 ? pendingLineItemPhotos : undefined,
  };
}
