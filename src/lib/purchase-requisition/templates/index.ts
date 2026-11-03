import { readFile } from "node:fs/promises";

// These VBA-driven workbooks (see vba-source/stores/, vba-source/spares/,
// vba-source/service/, and vba-source/lo/ for the readable macro code and setup guides — four
// independent VBA projects, no shared state) can't be authored by ExcelJS the
// way a plain
// generated template can — the binary VBA project component isn't something
// a generic spreadsheet library can safely write. Each is a static asset
// served as-is instead of generated per-request. `new URL(..., import.meta.url)`
// (rather than a process.cwd() join) is what lets Next.js's file tracer find
// and copy these files automatically if the project ever adopts
// `output: "standalone"`.
export async function readStoresTemplateBuffer(): Promise<Buffer> {
  return readFile(new URL("./requisition-form-stores.xlsm", import.meta.url));
}

export async function readSparesTemplateBuffer(): Promise<Buffer> {
  return readFile(new URL("./requisition-form-spares.xlsm", import.meta.url));
}

export async function readServiceTemplateBuffer(): Promise<Buffer> {
  return readFile(new URL("./requisition-form-service.xlsm", import.meta.url));
}

// LO (Lub Oil): the Stores workbook without the IMPA/ISSA Code column (see
// vba-source/lo/).
export async function readLoTemplateBuffer(): Promise<Buffer> {
  return readFile(new URL("./requisition-form-lo.xlsm", import.meta.url));
}
