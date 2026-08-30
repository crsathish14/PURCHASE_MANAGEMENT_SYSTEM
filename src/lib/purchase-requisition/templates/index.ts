import { readFile } from "node:fs/promises";

// These VBA-driven workbooks (see vba-source/stores/, vba-source/spares/, and
// vba-source/service/ for the readable macro code and setup guides — three
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
