import type ExcelJS from "exceljs";

import { cellText } from "./import-template-shared";

// Shared by every VBA-driven template format (Stores, Spares, ...) — each is
// an independent macro workbook/VBA project with its own label text and
// column layout, but they're built from the same proven architecture (see
// each format's own templates/vba-source/<format>/ setup guide), so the
// underlying OOXML-reading logic below — merge-aware label lookup, dynamic
// table-section sizing, image-anchor extraction — is written once here and
// reused rather than duplicated per format.

export function normalize(text: string): string {
  return text.replace(/\r\n|\r|\n/g, " ").trim().toLowerCase();
}

// Every format's two "Sl No." columns (line items vs. the photo table) are
// inconsistently labeled in the source file itself — "Sl No." in one table,
// "Sl.No." in the other (confirmed directly against the real Stores file,
// then again in the independently-built Spares file) — so this is matched by
// pattern rather than the exact-string equality every other label uses.
const SL_NO_PATTERN = /^sl\.?\s*no\.?$/;
export function isSlNoLabel(normalizedText: string): boolean {
  return SL_NO_PATTERN.test(normalizedText);
}

export type CellLocation = { row: number; col: number };
export type MergeSpan = { left: number; right: number; top: number; bottom: number };

function decodeCellRef(ref: string): CellLocation {
  const match = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!match) return { row: 0, col: 0 };
  const [, colLetters, rowDigits] = match;
  let col = 0;
  for (const ch of colLetters) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(rowDigits), col };
}

// Keyed by the merge's top-left "row:col" so a label cell's own merge span
// can be looked up directly once its location is known.
export function buildMergeMap(sheet: ExcelJS.Worksheet): Map<string, MergeSpan> {
  const map = new Map<string, MergeSpan>();
  for (const range of sheet.model.merges ?? []) {
    const [tlRef, brRef] = range.split(":");
    const tl = decodeCellRef(tlRef);
    const br = brRef ? decodeCellRef(brRef) : tl;
    map.set(`${tl.row}:${tl.col}`, { left: tl.col, right: br.col, top: tl.row, bottom: br.row });
  }
  return map;
}

// How many rows a cell's own merge spans (1 if it isn't merged at all) —
// needed because these templates locate whole table sections relative to
// each other's actual height rather than a fixed offset (each format's own
// VBA source's GetImageTableFirstDataRow does the same, specifically because
// the SUPPORTING PHOTOS heading grew from 1 row to 2 between the Stores
// template's own revisions — mirrored here so a future revision, on either
// format, doesn't silently break this parser the same way a hardcoded offset
// would have).
export function getMergeRowSpan(mergeMap: Map<string, MergeSpan>, row: number, col: number): number {
  const span = mergeMap.get(`${row}:${col}`);
  return span ? span.bottom - span.top + 1 : 1;
}

export function findLabelCell(sheet: ExcelJS.Worksheet, normalizedLabel: string): CellLocation | null {
  let found: CellLocation | null = null;
  sheet.eachRow((row, rowNumber) => {
    if (found) return;
    row.eachCell((cell, colNumber) => {
      if (found) return;
      if (normalize(cellText(cell)) === normalizedLabel) found = { row: rowNumber, col: colNumber };
    });
  });
  return found;
}

// Restricted to a single column — needed specifically for "SUPPORTING
// PHOTOS", whose text is NOT unique on the sheet: the line-items table's own
// per-row "Supporting Photos" input-cell column header normalizes to the
// exact same string, and it appears earlier (row-wise) than the real table
// heading, so a full-sheet first-match search would find the wrong one. The
// real heading is always anchored at column A (confirmed against both the
// Stores and Spares files), matching each format's own VBA source
// (FindRowByLabel, which only ever searches column COL_SLNO) — mirrored here
// rather than reused generically, since every other label on these sheets IS
// unique sheet-wide.
export function findLabelCellInColumn(
  sheet: ExcelJS.Worksheet,
  normalizedLabel: string,
  col: number,
): CellLocation | null {
  let found: CellLocation | null = null;
  sheet.eachRow((row, rowNumber) => {
    if (found) return;
    if (normalize(cellText(row.getCell(col))) === normalizedLabel) found = { row: rowNumber, col };
  });
  return found;
}

// The value for a label is never simply "one cell to the right" here — a
// label can itself be a multi-column merge (e.g. "IMO No" spans H12:I12), so
// its value starts one column past the END of the label's own merge span,
// not one column past the label cell itself.
export function readLabeledValue(
  sheet: ExcelJS.Worksheet,
  mergeMap: Map<string, MergeSpan>,
  loc: CellLocation | null,
): string {
  if (!loc) return "";
  const span = mergeMap.get(`${loc.row}:${loc.col}`);
  const labelEndCol = span?.right ?? loc.col;
  return cellText(sheet.getRow(loc.row).getCell(labelEndCol + 1));
}

// The Date cell can hold a raw Excel serial number (e.g. 45526) instead of a
// value ExcelJS infers as a Date — confirmed directly in both formats'
// sample files.
export function readDateValue(
  sheet: ExcelJS.Worksheet,
  mergeMap: Map<string, MergeSpan>,
  loc: CellLocation | null,
): string {
  if (!loc) return "";
  const span = mergeMap.get(`${loc.row}:${loc.col}`);
  const labelEndCol = span?.right ?? loc.col;
  const cell = sheet.getRow(loc.row).getCell(labelEndCol + 1);
  const value = cell.value;
  if (typeof value === "number") {
    const d = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return cellText(cell);
}

// Both formats key detection off the same "Vessel Name" label — the field
// text and position convention is identical, only what surrounds it differs.
export function isVbaRequisitionSheet(sheet: ExcelJS.Worksheet): boolean {
  return findLabelCell(sheet, "vessel name") !== null;
}

export function findLineItemHeaderRow(sheet: ExcelJS.Worksheet): number | null {
  let found: number | null = null;
  sheet.eachRow((row, rowNumber) => {
    if (found !== null) return;
    let hasDescription = false;
    row.eachCell((cell) => {
      if (normalize(cellText(cell)) === "description") hasDescription = true;
    });
    if (hasDescription) found = rowNumber;
  });
  return found;
}

export type ParsedLineItemRow = { slNo: string; description: string; qty: string; extra: Record<string, string> };

// Data rows start below the header's own merged row-span (read from the Sl
// No. column's merge, mirroring each format's own GetLastLineItemRow-style
// COL_SLNO-relative approach — not assumed to always be 2, since the
// SUPPORTING PHOTOS table's heading is proof these templates' section
// heights do change between revisions) and the scan stops the moment Sl No.
// is blank — that column, not "any column has a value", is each template's
// authoritative row boundary.
export function parseLineItemRows(
  sheet: ExcelJS.Worksheet,
  mergeMap: Map<string, MergeSpan>,
  headerRow: number,
  columnMap: Map<string, number>,
  columns: { key: string; label: string }[],
): ParsedLineItemRow[] {
  const slNoCol = columnMap.get("slNo");
  if (slNoCol === undefined) return [];

  const headerSpan = getMergeRowSpan(mergeMap, headerRow, slNoCol);
  const rows: ParsedLineItemRow[] = [];
  for (let rowNumber = headerRow + headerSpan; ; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const slNo = cellText(row.getCell(slNoCol));
    if (!slNo) break;

    const descriptionCol = columnMap.get("description");
    const qtyCol = columnMap.get("qty");
    const extra: Record<string, string> = {};
    for (const column of columns) {
      const col = columnMap.get(column.key);
      extra[column.key] = col !== undefined ? cellText(row.getCell(col)) : "";
    }
    rows.push({
      slNo,
      description: descriptionCol !== undefined ? cellText(row.getCell(descriptionCol)) : "",
      qty: qtyCol !== undefined ? cellText(row.getCell(qtyCol)) : "",
      extra,
    });
  }
  return rows;
}

export type ImageTable = { dataStartRow: number; slNoCol: number; slotColumns: number[] };

// Ground truth from each format's own modConstants.bas — used only as a
// fallback if the header-text scan below (the primary, drift-tolerant path)
// somehow can't find all 7 slot columns, since this table's structure is
// fixed/protected rather than user-editable. Both the Stores and Spares
// workbooks independently arrived at the same 7-slot, B/D/F/H/J/L/N layout.
const FALLBACK_SLOT_COLUMNS = [2, 4, 6, 8, 10, 12, 14]; // B, D, F, H, J, L, N
const SLOT_LABEL_PATTERN = /^photo ([1-7])$/;
const SLOT_COUNT = FALLBACK_SLOT_COLUMNS.length;

// Locates the SUPPORTING PHOTOS table by heading text, then walks past the
// heading's own row-span and the column-header block's row-span — both read
// from their actual merges, not assumed — to find the first real data row.
// This mirrors each format's own GetImageTableFirstDataRow exactly,
// including its stated reason for doing it this way: the heading went from
// 1 row to 2 between the Stores template's revisions, and a hardcoded offset
// would have silently pointed at the wrong row.
export function findImageTable(sheet: ExcelJS.Worksheet, mergeMap: Map<string, MergeSpan>): ImageTable | null {
  const headingLoc = findLabelCellInColumn(sheet, "supporting photos", 1);
  if (!headingLoc) return null;
  const headingSpan = getMergeRowSpan(mergeMap, headingLoc.row, 1);
  const headerRow = headingLoc.row + headingSpan;
  const headerSpan = getMergeRowSpan(mergeMap, headerRow, 1);
  const dataStartRow = headerRow + headerSpan;

  let slNoCol: number | null = null;
  const slotColumns: number[] = [];
  for (let rowNumber = headerRow; rowNumber < headerRow + headerSpan; rowNumber += 1) {
    sheet.getRow(rowNumber).eachCell((cell, colNumber) => {
      const text = normalize(cellText(cell));
      if (isSlNoLabel(text) && slNoCol === null) slNoCol = colNumber;
      const match = SLOT_LABEL_PATTERN.exec(text);
      // first-match-wins, deliberately: "Photo 4"/"5"/etc. are themselves
      // 2-column merges (H:I, J:K, ...), and ExcelJS's merge-cell reads make
      // every cell in the merge report the same text — so eachCell visits
      // each of these labels twice. Only the FIRST (master, leftmost)
      // column is where a picture's drawing anchor can ever actually land
      // (confirmed directly against the real sample files — recording the
      // merge's second column here silently missed photos), so this must
      // never let a later match overwrite an earlier one, unlike a plain
      // value read where either column would do.
      const slotIndex = match ? Number(match[1]) - 1 : -1;
      if (match && slotColumns[slotIndex] === undefined) slotColumns[slotIndex] = colNumber;
    });
  }

  const resolvedSlots = slotColumns.filter((c) => c !== undefined);
  return {
    dataStartRow,
    slNoCol: slNoCol ?? 1,
    slotColumns: resolvedSlots.length === SLOT_COUNT ? slotColumns : FALLBACK_SLOT_COLUMNS,
  };
}

// "row:col" (1-indexed, matching the sheet's own cell coordinates) -> the
// embedded image anchored with its top-left corner there. Cell VALUES are
// never used for images — per each format's own VBA source comments, the
// Supporting Photos input cell's "N photos" counter is written by the macro
// purely for the user's benefit and is never read back by anything; the
// drawing anchors are the only source of truth here too.
export function buildImagePositionMap(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
): Map<string, ExcelJS.Image> {
  const map = new Map<string, ExcelJS.Image>();
  for (const entry of sheet.getImages()) {
    const row = entry.range.tl.nativeRow + 1;
    const col = entry.range.tl.nativeCol + 1;
    const image = workbook.getImage(Number(entry.imageId));
    if (image) map.set(`${row}:${col}`, image);
  }
  return map;
}

// Groups images by SL No. across however many continuation rows that SL No.
// spans (more than SLOT_COUNT photos means a second row with the SAME SL
// No.), in row order then slot-column order — this is what correctly
// reassembles a line item's full photo set.
export function gatherPhotosBySlNo(
  sheet: ExcelJS.Worksheet,
  imagePositions: Map<string, ExcelJS.Image>,
  table: ImageTable,
): Map<string, ExcelJS.Image[]> {
  const bySlNo = new Map<string, ExcelJS.Image[]>();
  for (let rowNumber = table.dataStartRow; ; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const slNo = cellText(row.getCell(table.slNoCol));
    if (!slNo) break;

    const images = bySlNo.get(slNo) ?? [];
    for (const col of table.slotColumns) {
      const image = imagePositions.get(`${rowNumber}:${col}`);
      if (image) images.push(image);
    }
    bySlNo.set(slNo, images);
  }
  return bySlNo;
}

export function excelImageToBlob(image: ExcelJS.Image, index: number): { blob: Blob; fileName: string } | null {
  const mime = image.extension === "jpeg" ? "image/jpeg" : image.extension === "png" ? "image/png" : "image/gif";
  let bytes: Uint8Array | null = null;
  if (image.buffer) {
    bytes = image.buffer instanceof Uint8Array ? image.buffer : new Uint8Array(image.buffer);
  } else if (image.base64) {
    const base64 = image.base64.includes(",") ? image.base64.split(",")[1] : image.base64;
    const binary = atob(base64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  }
  if (!bytes) return null;

  const extension = image.extension === "jpeg" ? "jpg" : image.extension;
  // exceljs's Node-oriented `Image.buffer` types as Buffer (Uint8Array over
  // ArrayBufferLike, which can include SharedArrayBuffer); Blob's BlobPart
  // wants a plain ArrayBuffer specifically. The bytes are always a real,
  // non-shared buffer here (read from a file or decoded from base64), so
  // this cast just narrows past a TS lib nominal-typing gap, not a runtime
  // risk.
  return {
    blob: new Blob([bytes as BlobPart], { type: mime }),
    fileName: image.filename ?? `photo-${index + 1}.${extension}`,
  };
}
