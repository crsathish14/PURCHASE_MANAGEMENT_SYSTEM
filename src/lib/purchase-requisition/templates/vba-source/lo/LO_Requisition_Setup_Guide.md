# LO (Lub Oil) Requisition Form — VBA Build & Setup Guide

Fourth independent form in this project (after Stores, Spares and Service) —
separate workbook, separate worksheet name (`LO Requisition Form`), separate
constants, no shared state. It is the **Stores form without the IMPA/ISSA Code
column**; everything else (header, photo table, footer, macros) is the same.

## How `requisition-form-lo.xlsm` was built

1. Copy `requisition-form-stores.xlsm`.
2. Rename the sheet to **LO Requisition Form** (unprotect the workbook structure
   first - password `PROTECT_PASSWORD` in `modConstants`).
3. Title cell C1: `REQUISITION FOR LUB OIL`. The form code/revision block
   (`FO G 011 A`, `REV.NO. 01`) was left as copied from Stores - change it in
   cell N1 if LO has its own form number.
4. Line-item table: delete the **IMPA/ISSA Code** column by merging
   Description across **B:G** (header rows 20:21 and the line-item row 22). No
   column is physically removed, so every other column keeps the Stores position:

   | Field | Column(s) |
   |---|---|
   | Sl No. | A |
   | Description | B:G |
   | QTY Requested | H |
   | UOM | I |
   | ROB | J |
   | Remarks | K:N |
   | Supporting Photos | O (single column) |

5. Replace the six modules with the ones in this folder, run
   `RebuildRowButtons` + `ApplyFormProtection`, save as `.xlsm`.

## Files in this folder

| File | What it is |
|---|---|
| `modConstants.bas` | Sheet name `LO Requisition Form`; otherwise the same values as Stores (first line item row 22, photos column 15) |
| `modSecurity.bas` | Same as Stores, except the IMPA/ISSA Code unlock line is gone (Description B:G is one merged area) |
| `modSetup.bas`, `modLineItems.bas`, `modImages.bas`, `modClipboardFile.bas`, `ThisWorkbook_code.txt` | Identical to the Stores versions - they locate everything dynamically |

`modImages` includes Ctrl+V of image data or image files copied in File Explorer,
and the per-row **Remove Last Photo / Remove All Photos / Remove Line Item**
buttons (column P onward, not printed) - see the Stores guide for how they behave.

## Setup (fresh copy, e.g. after editing the layout)

1. Open the workbook, **Alt+F11**, make sure the six modules match this folder
   and `ThisWorkbook_code.txt` is in `ThisWorkbook`.
2. **Debug → Compile VBAProject** - confirm clean.
3. Run **`RunInitialSetup`** once (Alt+F8): collapses to 1 line item, creates
   the Add Line Item button and the row buttons, protects the sheet.
4. Save, close, reopen once to confirm protection and Ctrl+V survive a session.

## Diagnostic tools (Alt+F8)

`DiagnoseSupportingPhotosCell`, `CleanupStrayInputPictures`,
`ApplyFormProtection`, `UnmergeSupportingPhotosInputCells`, `AddRowButtons`.

## Test checklist

| # | Test | Expected result |
|---|---|---|
| 1 | Open the form | Exactly one line item, Sl No. = 1; Description is one wide column, no IMPA/ISSA Code column |
| 2 | Fill in header fields and the line item | All accept text; Description spans B:G |
| 3 | Paste 7 images into Sl No. 1's Supporting Photos cell | All 7 land in Photo 1–7, cell shows "7 photos" |
| 4 | Paste an 8th image | New photo row created for Sl No. 1 |
| 5 | Click **Add Line Item** | Sl No. 2 appears with the same wide Description and its own three Remove buttons |
| 6 | Try clicking into SUPPORTING PHOTOS or the Sl No. column | Not selectable |
| 7 | **Remove Last Photo** on a line item with 8 photos | Continuation row deleted; "7 photos" |
| 8 | **Remove All Photos** on Sl No. 1 and confirm | Its photo rows are gone; other line items' photos intact |
| 9 | With 3 line items that have photos, **Remove Line Item** on Sl No. 2 | Numbered 1, 2; old Sl No. 3 is now 2 and keeps its photos; no buttons left behind |
| 10 | **Remove Line Item** on the only line item | Message that it can't be removed |
| 11 | Copy image files in File Explorer, Ctrl+V into a Supporting Photos cell | Every image is filed |
| 12 | Close and reopen | Protection and Ctrl+V still active |
