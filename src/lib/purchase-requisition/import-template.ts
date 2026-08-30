import ExcelJS from "exceljs";

import en from "@/locales/en.json";
import { PR_CATEGORY, PR_LINE_ITEM_PRESET_COLUMN, PR_PRIORITY } from "@/lib/constants/purchase-requisition";
import type { PrCategory } from "@/lib/constants/purchase-requisition";
import type { PrDropdownField } from "@/lib/data/purchase-requisition";
import type { Vessel } from "@/lib/data/vessels";
import { getPresetColumnsForCategory } from "@/lib/purchase-requisition/preset-columns";
import type { CreateRequisitionFormValues } from "@/lib/validation/purchase-requisition";
import { cellText, matchDropdownOption, type ParsedImportResult, type ParseImportError } from "./import-template-shared";
import { parseVbaRequisitionTemplate } from "./import-template-vba";
import { isVbaRequisitionSheet } from "./import-template-vba-shared";
import { parseSparesVbaRequisitionTemplate } from "./import-template-vba-spares";

export type { ParsedImportResult, ParseImportError } from "./import-template-shared";

const t = en.staff.poRequests.createDialog;
const importT = en.staff.poRequests.importMenu;

// Both categories' downloads are VBA-driven workbooks now (see
// import-template-vba.ts / import-template-vba-spares.ts), so this legacy
// ExcelJS-generated format (marked by this hidden sheet) is no longer
// produced by src/app/api/purchase-requisitions/import-template/route.ts for
// either category — this branch is kept only so a file downloaded before
// that switch still parses correctly.
const TEMPLATE_MARKER_SHEET = "_pms_meta";
const TEMPLATE_MARKER_CELL = "A1";
const TEMPLATE_MARKER_PREFIX = "pms-pr-template:";
const REQUISITION_SHEET_NAME = "Requisition";
// "Stores Requisition Form" — the v2 template's sheet name. v1 files (sheet
// named "Requisition Form") are no longer recognized; the paper form itself
// was revised, so this is a full replacement, not a dual-format dispatch.
const VBA_SHEET_NAME = "Stores Requisition Form";
// The Spares VBA workbook is a completely independent project (own sheet
// name, own layout) — see import-template-vba-spares.ts.
const SPARES_VBA_SHEET_NAME = "Spares Requisition Form";

// Scans every cell in the sheet for a known label and records whatever's in
// the cell immediately to its right as that label's value — robust to the
// label moving rows (e.g. a user inserting/deleting a row) as long as the
// label/value pairing stays horizontal, which is how the generator always
// lays the header block out.
function buildLabelValueMap(sheet: ExcelJS.Worksheet): Map<string, string> {
  const map = new Map<string, string>();
  sheet.eachRow((row) => {
    row.eachCell((cell, colNumber) => {
      const label = cellText(cell).toLowerCase();
      if (!label) return;
      const value = cellText(row.getCell(colNumber + 1));
      if (value) map.set(label, value);
    });
  });
  return map;
}

function findLabel(map: Map<string, string>, ...labels: string[]): string {
  for (const label of labels) {
    const value = map.get(label.toLowerCase());
    if (value) return value;
  }
  return "";
}

// Approved Qty is deliberately absent here — the template never asks for it
// (office-only, filled in during review), so there's nothing for a header
// named "Approved Qty" to ever match against in an uploaded file. It still
// ends up as a real column after import via getPresetColumnsForCategory()
// below, just always blank.
const LINE_ITEM_COLUMN_KEY_BY_LABEL: Record<string, string> = {
  [t.columns.lineItemRemarks.toLowerCase()]: PR_LINE_ITEM_PRESET_COLUMN.REMARKS,
  [t.columns.partNo.toLowerCase()]: PR_LINE_ITEM_PRESET_COLUMN.PART_NO,
  [t.columns.impaCode.toLowerCase()]: PR_LINE_ITEM_PRESET_COLUMN.IMPA_CODE,
  [t.columns.uom.toLowerCase()]: PR_LINE_ITEM_PRESET_COLUMN.UOM,
  [t.columns.rob.toLowerCase()]: PR_LINE_ITEM_PRESET_COLUMN.ROB,
};

function parseLegacyWorkbook(
  sheet: ExcelJS.Worksheet,
  marker: string,
  dropdownFields: PrDropdownField[],
  fileName: string,
): ParsedImportResult | ParseImportError {
  const markerCategory = marker.slice(TEMPLATE_MARKER_PREFIX.length).split(":")[0];
  if (markerCategory !== PR_CATEGORY.STORES && markerCategory !== PR_CATEGORY.SPARES) {
    return { error: importT.parseError };
  }
  const category: PrCategory = markerCategory;
  const isSpares = category === PR_CATEGORY.SPARES;

  const warnings: string[] = [];
  const labelValue = buildLabelValueMap(sheet);

  const vesselField = dropdownFields.find((field) => field.key === "vessel");
  const departmentField = dropdownFields.find((field) => field.key === "department");
  const vesselTyped = findLabel(labelValue, vesselField?.label ?? "Vessel");
  const departmentTyped = findLabel(labelValue, departmentField?.label ?? "Department");
  const vesselValue = matchDropdownOption(vesselField, vesselTyped);
  const departmentValue = matchDropdownOption(departmentField, departmentTyped);
  if (vesselTyped && !vesselValue) {
    warnings.push(`Vessel "${vesselTyped}" wasn't recognized — choose it manually.`);
  }
  if (departmentTyped && !departmentValue) {
    warnings.push(`Department "${departmentTyped}" wasn't recognized — choose it manually.`);
  }

  const priorityTyped = findLabel(labelValue, t.priority).toLowerCase();
  const priorityByLabel: Record<string, string> = {
    [t.priorityOptions.high.toLowerCase()]: PR_PRIORITY.HIGH,
    [t.priorityOptions.medium.toLowerCase()]: PR_PRIORITY.MEDIUM,
    [t.priorityOptions.low.toLowerCase()]: PR_PRIORITY.LOW,
  };
  const priority = priorityByLabel[priorityTyped] ?? "";

  const dropdowns: Record<string, string> = Object.fromEntries(dropdownFields.map((field) => [field.key, ""]));
  if (vesselValue) dropdowns.vessel = vesselValue;
  if (departmentValue) dropdowns.department = departmentValue;
  dropdowns.category = category;

  // Line-item header row: the row containing a cell that reads exactly
  // "Description" — everything below it, until the sheet runs out of rows,
  // is scanned for data rows. Columns are matched by header text (not a
  // fixed index), so the generator's exact column order doesn't need to stay
  // frozen forever.
  let headerRowNumber: number | null = null;
  let columnKeyByIndex = new Map<number, string>();
  sheet.eachRow((row, rowNumber) => {
    if (headerRowNumber !== null) return;
    let descriptionCol: number | null = null;
    row.eachCell((cell, colNumber) => {
      if (cellText(cell).toLowerCase() === t.columns.description.toLowerCase()) descriptionCol = colNumber;
    });
    if (descriptionCol === null) return;
    headerRowNumber = rowNumber;
    const map = new Map<number, string>();
    row.eachCell((cell, colNumber) => {
      const label = cellText(cell).toLowerCase();
      if (label === t.columns.description.toLowerCase()) map.set(colNumber, "description");
      else if (label === t.columns.qty.toLowerCase()) map.set(colNumber, "qty");
      else if (LINE_ITEM_COLUMN_KEY_BY_LABEL[label]) map.set(colNumber, LINE_ITEM_COLUMN_KEY_BY_LABEL[label]);
    });
    columnKeyByIndex = map;
  });

  // Always the category's full preset set (matching what a manually-created
  // PR of the same category gets) — not just whatever columns the uploaded
  // file happened to contain. This is what guarantees Approved Qty exists as
  // a real, blank, ready-to-fill column after import even though the
  // template never asks for it.
  const columns = getPresetColumnsForCategory(category);

  const lineItems: CreateRequisitionFormValues["lineItems"] = [];
  if (headerRowNumber !== null) {
    const startRow: number = headerRowNumber + 1;
    for (let rowNumber = startRow; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const rowValues = new Map<string, string>();
      columnKeyByIndex.forEach((key, colNumber) => {
        rowValues.set(key, cellText(row.getCell(colNumber)));
      });
      const description = rowValues.get("description") ?? "";
      const hasAnyValue = [...rowValues.values()].some((v) => v.trim().length > 0);
      if (!hasAnyValue) continue;
      lineItems.push({
        description,
        qty: rowValues.get("qty") ?? "",
        extra: Object.fromEntries(columns.map((c) => [c.key, rowValues.get(c.key) ?? ""])),
        attachments: [],
      });
    }
  }
  if (lineItems.length === 0) {
    lineItems.push({ description: "", qty: "", extra: Object.fromEntries(columns.map((c) => [c.key, ""])), attachments: [] });
  }

  const values: Partial<CreateRequisitionFormValues> = {
    priority,
    dropdowns,
    requestedBy: "",
    requiredPort: findLabel(labelValue, t.requiredPort),
    requisitionNumber: findLabel(labelValue, t.requisitionNumber),
    requisitionDate: findLabel(labelValue, t.requisitionDate),
    title: findLabel(labelValue, t.requisitionTitle),
    remarks: "",
    equipmentName: isSpares ? findLabel(labelValue, t.equipmentDetails.nameOfEquipment) : "",
    equipmentType: isSpares ? findLabel(labelValue, t.equipmentDetails.type) : "",
    equipmentMake: isSpares ? findLabel(labelValue, t.equipmentDetails.make) : "",
    equipmentSerialNo: isSpares ? findLabel(labelValue, t.equipmentDetails.serialNo) : "",
    equipmentModel: isSpares ? findLabel(labelValue, t.equipmentDetails.model) : "",
    equipmentSpecifications: isSpares ? findLabel(labelValue, t.equipmentDetails.specifications) : "",
    equipmentOtherDetails: isSpares ? findLabel(labelValue, t.equipmentDetails.otherDetails) : "",
    requisitionedBy: "",
    captainChiefEngineer: "",
    customFields: [],
    columns,
    lineItems,
  };

  return { category, fileName, values, warnings };
}

export async function parseRequisitionTemplateFile(
  file: File,
  dropdownFields: PrDropdownField[],
  vessels: Vessel[],
): Promise<ParsedImportResult | ParseImportError> {
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xlsm")) {
    return { error: importT.unsupportedFileType };
  }

  let workbook: ExcelJS.Workbook;
  try {
    const buffer = await file.arrayBuffer();
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
  } catch {
    return { error: importT.parseError };
  }

  const metaSheet = workbook.getWorksheet(TEMPLATE_MARKER_SHEET);
  const marker = cellText(metaSheet?.getCell(TEMPLATE_MARKER_CELL));
  if (marker.startsWith(TEMPLATE_MARKER_PREFIX)) {
    const sheet = workbook.getWorksheet(REQUISITION_SHEET_NAME);
    if (!sheet) return { error: importT.parseError };
    return parseLegacyWorkbook(sheet, marker, dropdownFields, file.name);
  }

  const vbaSheet = workbook.getWorksheet(VBA_SHEET_NAME);
  if (vbaSheet && isVbaRequisitionSheet(vbaSheet)) {
    return parseVbaRequisitionTemplate(workbook, vbaSheet, dropdownFields, vessels, file.name);
  }

  const sparesVbaSheet = workbook.getWorksheet(SPARES_VBA_SHEET_NAME);
  if (sparesVbaSheet && isVbaRequisitionSheet(sparesVbaSheet)) {
    return parseSparesVbaRequisitionTemplate(workbook, sparesVbaSheet, dropdownFields, vessels, file.name);
  }

  return { error: importT.parseError };
}
