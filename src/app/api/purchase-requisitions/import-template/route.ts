import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import en from "@/locales/en.json";
import { PR_CATEGORY } from "@/lib/constants/purchase-requisition";
import type { PrCategory } from "@/lib/constants/purchase-requisition";
import { getPrDropdownFields } from "@/lib/data/purchase-requisition";
import { requireApiActiveUser } from "@/lib/supabase/require-active-user";

const t = en.staff.poRequests.createDialog;

// Bumped only if the template's cell/sheet layout changes in a way the
// parser (src/lib/purchase-requisition/import-template.ts) needs to key off
// of — the two files are a matched pair, read together.
const TEMPLATE_VERSION = "v1";
export const TEMPLATE_MARKER_SHEET = "_pms_meta";
export const TEMPLATE_MARKER_CELL = "A1";
export function templateMarkerValue(category: PrCategory): string {
  return `pms-pr-template:${category}:${TEMPLATE_VERSION}`;
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE8EDF5" },
};
const LABEL_FONT: Partial<ExcelJS.Font> = { bold: true, size: 10 };
const SECTION_FONT: Partial<ExcelJS.Font> = { bold: true, size: 11, color: { argb: "FF1F2A44" } };
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD0D6E2" } },
  left: { style: "thin", color: { argb: "FFD0D6E2" } },
  bottom: { style: "thin", color: { argb: "FFD0D6E2" } },
  right: { style: "thin", color: { argb: "FFD0D6E2" } },
};

const LINE_ITEM_BLANK_ROWS = 20;

function labelCell(sheet: ExcelJS.Worksheet, ref: string, text: string) {
  const cell = sheet.getCell(ref);
  cell.value = text;
  cell.font = LABEL_FONT;
}

function inputCell(sheet: ExcelJS.Worksheet, ref: string) {
  const cell = sheet.getCell(ref);
  cell.border = THIN_BORDER;
  return cell;
}

// A data-validation list formula that references a range on ANOTHER sheet
// directly (e.g. "Lists!$A$2:$A$4") is not something Excel's own UI can even
// author — cross-sheet list sources must go through a workbook-level defined
// name — and writing the raw cross-sheet form anyway is exactly what
// produced the "repaired/removed unreadable content" prompt Excel throws on
// this sheet's XML. Every dropdown cell below goes through this helper so
// none of them can regress back to that raw form. Also guards against an
// empty option list, which would otherwise produce an inverted range
// (e.g. "$A$2:$A$1") — same class of corruption — by skipping validation
// entirely and leaving the cell as plain free text in that case.
function addListValidation(
  workbook: ExcelJS.Workbook,
  cell: ExcelJS.Cell,
  definedName: string,
  rangeRef: string,
  optionCount: number,
) {
  if (optionCount <= 0) return;
  workbook.definedNames.add(rangeRef, definedName);
  cell.dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: [definedName],
    showErrorMessage: true,
    errorTitle: "Invalid selection",
    error: "Please choose a value from the dropdown list.",
  };
}

export async function GET(request: Request) {
  const auth = await requireApiActiveUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const categoryParam = searchParams.get("category");
  if (categoryParam !== PR_CATEGORY.STORES && categoryParam !== PR_CATEGORY.SPARES) {
    return NextResponse.json(
      { error: { message: "Unknown or unsupported template category." } },
      { status: 400 },
    );
  }
  const category: PrCategory = categoryParam;
  const isSpares = category === PR_CATEGORY.SPARES;

  let dropdownFields;
  try {
    dropdownFields = await getPrDropdownFields();
  } catch (error) {
    console.error("[api/purchase-requisitions/import-template:GET]", error);
    return NextResponse.json({ error: { message: "Couldn't build the template." } }, { status: 500 });
  }

  const vesselOptions = dropdownFields.find((field) => field.key === "vessel")?.options ?? [];
  const departmentOptions = dropdownFields.find((field) => field.key === "department")?.options ?? [];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PMS";
  workbook.created = new Date();

  // Hidden reference lists the header dropdowns validate against — kept on
  // their own sheet (not inline formulae) since option lists are DB-driven
  // and can be long/contain commas.
  const listsSheet = workbook.addWorksheet("Lists", { state: "veryHidden" });
  listsSheet.getColumn(1).values = ["Vessel", ...vesselOptions.map((option) => option.label)];
  listsSheet.getColumn(2).values = ["Department", ...departmentOptions.map((option) => option.label)];
  listsSheet.getColumn(3).values = ["Priority", t.priorityOptions.high, t.priorityOptions.medium, t.priorityOptions.low];

  const metaSheet = workbook.addWorksheet(TEMPLATE_MARKER_SHEET, { state: "veryHidden" });
  metaSheet.getCell(TEMPLATE_MARKER_CELL).value = templateMarkerValue(category);

  const sheet = workbook.addWorksheet("Requisition", {
    views: [{ state: "frozen", ySplit: 0 }],
  });
  // "Requisition" is the 3rd sheet added (after the two veryHidden ones) —
  // without this, the workbook's active tab defaults to sheet index 0
  // ("Lists", hidden), which is its own source of Excel repair prompts on
  // open.
  workbook.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 2, visibility: "visible" }];
  sheet.columns = [
    { width: 22 },
    { width: 26 },
    { width: 22 },
    { width: 26 },
    { width: 22 },
    { width: 26 },
  ];

  const sheetTitle = isSpares
    ? "Requisition For Spares - Deck & Engine"
    : "Requisition For Stores - Deck & Engine";
  sheet.mergeCells("A1:F1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = sheetTitle;
  titleCell.font = { bold: true, size: 13 };

  const vesselLabel = dropdownFields.find((field) => field.key === "vessel")?.label ?? "Vessel";
  const departmentLabel = dropdownFields.find((field) => field.key === "department")?.label ?? "Department";
  labelCell(sheet, "A3", vesselLabel);
  addListValidation(
    workbook,
    inputCell(sheet, "B3"),
    "PmsVesselOptions",
    `Lists!$A$2:$A$${vesselOptions.length + 1}`,
    vesselOptions.length,
  );
  labelCell(sheet, "C3", departmentLabel);
  addListValidation(
    workbook,
    inputCell(sheet, "D3"),
    "PmsDepartmentOptions",
    `Lists!$B$2:$B$${departmentOptions.length + 1}`,
    departmentOptions.length,
  );

  labelCell(sheet, "A4", t.requisitionDate);
  const dateCell = inputCell(sheet, "B4");
  dateCell.numFmt = "yyyy-mm-dd";
  labelCell(sheet, "C4", t.requisitionNumber);
  inputCell(sheet, "D4");

  labelCell(sheet, "A5", t.requisitionTitle);
  sheet.mergeCells("B5:D5");
  inputCell(sheet, "B5");

  labelCell(sheet, "A6", t.priority);
  addListValidation(workbook, inputCell(sheet, "B6"), "PmsPriorityOptions", "Lists!$C$2:$C$4", 3);
  labelCell(sheet, "C6", t.requestedBy);
  const requiredByCell = inputCell(sheet, "D6");
  requiredByCell.numFmt = "yyyy-mm-dd";

  labelCell(sheet, "A7", t.requiredPort);
  sheet.mergeCells("B7:D7");
  inputCell(sheet, "B7");

  let cursor = 9;

  if (isSpares) {
    sheet.mergeCells(`A${cursor}:F${cursor}`);
    const eqHeader = sheet.getCell(`A${cursor}`);
    eqHeader.value = t.equipmentDetails.title.toUpperCase();
    eqHeader.font = SECTION_FONT;
    eqHeader.fill = HEADER_FILL;
    cursor += 1;

    labelCell(sheet, `A${cursor}`, t.equipmentDetails.nameOfEquipment);
    inputCell(sheet, `B${cursor}`);
    labelCell(sheet, `C${cursor}`, t.equipmentDetails.type);
    inputCell(sheet, `D${cursor}`);
    cursor += 1;

    labelCell(sheet, `A${cursor}`, t.equipmentDetails.make);
    inputCell(sheet, `B${cursor}`);
    labelCell(sheet, `C${cursor}`, t.equipmentDetails.serialNo);
    inputCell(sheet, `D${cursor}`);
    cursor += 1;

    labelCell(sheet, `A${cursor}`, t.equipmentDetails.model);
    inputCell(sheet, `B${cursor}`);
    labelCell(sheet, `C${cursor}`, t.equipmentDetails.specifications);
    sheet.mergeCells(`D${cursor}:F${cursor}`);
    inputCell(sheet, `D${cursor}`);
    cursor += 1;

    labelCell(sheet, `A${cursor}`, t.equipmentDetails.otherDetails);
    sheet.mergeCells(`B${cursor}:F${cursor}`);
    inputCell(sheet, `B${cursor}`);
    cursor += 2;
  }

  sheet.mergeCells(`A${cursor}:F${cursor}`);
  const lineItemsHeader = sheet.getCell(`A${cursor}`);
  lineItemsHeader.value = t.lineItemsTitle.toUpperCase();
  lineItemsHeader.font = SECTION_FONT;
  lineItemsHeader.fill = HEADER_FILL;
  cursor += 1;

  // Column headers are matched by exact text at parse time (not position),
  // so this order can drift from the parser's expectations without breaking
  // anything as long as both stay in sync with PR_LINE_ITEM_PRESET_COLUMN's
  // label strings in en.json. Approved Qty is deliberately NOT one of these
  // — it's office-only, filled in during review after RFQ/quotes, never
  // known by the crew filling this template — but it still lands as a
  // ready-to-fill column after import, since the parser always adds the
  // full getPresetColumnsForCategory() set regardless of what the file
  // itself contained.
  const lineItemHeaders = isSpares
    ? [t.columns.description, t.columns.partNo, t.columns.qty, t.columns.rob, t.columns.lineItemRemarks]
    : [
        t.columns.description,
        t.columns.impaCode,
        t.columns.uom,
        t.columns.qty,
        t.columns.rob,
        t.columns.lineItemRemarks,
      ];
  const headerRow = sheet.getRow(cursor);
  lineItemHeaders.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = LABEL_FONT;
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
  });
  headerRow.commit();
  cursor += 1;

  for (let i = 0; i < LINE_ITEM_BLANK_ROWS; i += 1) {
    const row = sheet.getRow(cursor + i);
    lineItemHeaders.forEach((_, index) => {
      row.getCell(index + 1).border = THIN_BORDER;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = isSpares ? "pms-spares-requisition-template.xlsx" : "pms-store-requisition-template.xlsx";

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
