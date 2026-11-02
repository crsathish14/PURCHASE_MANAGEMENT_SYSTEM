# Spares Requisition Form — VBA Build & Setup Guide

This is a **completely independent** project from the Stores Requisition form —
separate workbook, separate worksheet name, separate constants module, no shared
state. It reuses the same proven architecture and all the fixes learned while
building that one, applied fresh to this template's actual layout.

## Files in this delivery

| File | What it is |
|---|---|
| `Spares Requisition Form Template.xlsx` | The template with the accidental "Chart1" sheet removed, date validation added, and correct cells unlocked. Not yet macro-enabled. |
| `modConstants.bas` | All configuration values for this form - sheet name, columns, photo limit, etc. |
| `modSetup.bas` | One-time `RunInitialSetup` routine + button creation (Add Line Item and the per-line-item Remove buttons); `AddRowButtons` for already-set-up templates |
| `modSecurity.bas` | Protection settings, self-healing cell unlocking (including the new Equipment Details fields), Ctrl+V key binding |
| `modLineItems.bas` | `AddLineItem` + creation/cleanup of each line item row's Remove buttons - identical to the Stores form's version; it never references a hard-coded cell address |
| `modImages.bas` | Paste detection, photo filing logic, diagnostics - identical to the Stores form's final version, including the file-reference/Win32 fallback and all the merged-cell fixes |
| `modClipboardFile.bas` | Win32 clipboard file-path reader - identical, no form-specific logic at all |
| `ThisWorkbook_code.txt` | Code to paste into the `ThisWorkbook` object - identical |

## Why so little changed

Only `modConstants.bas` and the cell-address list inside `modSecurity.bas`'s
`EnsureInputCellsUnlocked` actually needed new content. Everything else locates
things dynamically (by label search, or relative to the constants) rather than
hard-coding row/column numbers, so it works unmodified against a completely
different layout. The only genuinely new piece of logic is unlocking the seven
Equipment Details fields, which didn't exist on the Stores form.

One nice side effect of this template's design: **the Supporting Photos input
cell here is already a single, unmerged column (O)** - the exact fix we had to
retrofit onto the Stores form after extensive troubleshooting. This form never
had that problem to begin with.

## Setup (same process as the Stores form)

1. Open `Spares Requisition Form Template.xlsx` → **File → Save As** →
   **Excel Macro-Enabled Workbook (\*.xlsm)**.
2. **Alt+F11** → **Import File** each `.bas` module (`modConstants`, `modSetup`,
   `modSecurity`, `modLineItems`, `modImages`, `modClipboardFile`). Paste
   `ThisWorkbook_code.txt` into the `ThisWorkbook` object directly (don't
   import it - it's not a standard module).
3. **Debug → Compile VBAProject** - confirm clean before doing anything else.
4. Run **`RunInitialSetup`** once (F5, or Alt+F8). Confirms the prompt,
   collapses the 3 template rows to 1, creates the button, protects the sheet.
5. Save, close, reopen once to confirm protection and Ctrl+V survive a real
   session, then hand off.

## Removing photos and line items

Pictures are floating shapes and the sheet is protected, so the client cannot
select or delete them. Every line item row therefore has three small buttons
in the columns just right of the table (column P onward; not printed). Each
acts on **its own row**:

- **Remove Last Photo** - removes the most recently filed photo of that line
  item (like an undo for the last Ctrl+V). No confirmation.
- **Remove All Photos** - removes every photo of that line item, after a
  Yes/No confirmation showing how many will go.
- **Remove Line Item** - removes the line item, its photos and its photo-table
  rows, after a Yes/No confirmation, then renumbers every later Sl No. down by
  one in **both** tables so photos stay matched to their line item. The only
  remaining line item can't be removed.

The buttons find their row from their own position (`Application.Caller`).
`AddLineItem` creates a set for each new row; removing a line item deletes its
set. Photo removal deletes a photo row that becomes empty (never just blanks
its Sl No. - every scan in `modImages` stops at the first blank Sl No.), keeps
the table's only data row as the formatting template, and refreshes the
"N photos" counter. The code is identical to the Stores form's; only
`modConstants` differs.

**Updating a template that was already set up** (it has the Add Line Item
button but not the Remove buttons): replace the `modConstants`, `modSetup`,
`modImages` and `modLineItems` code with the current versions, then run
**`AddRowButtons`** once (Alt+F8) and save. Do not re-run `RunInitialSetup`.

## Cell map reference

**Header:** Vessel Name C12:G12 · IMO No K12:O12 · Date C13:G13 (validated) ·
Requisition No K13:O13 · Supply Port C14:G14 · Title C17:H17

**Equipment Details:** Name of Equipment C21:G21 · Type K21:O21 · Make C22:G22 ·
Sr. No. K22:O22 · Model C23:G23 · Specifications K23:O23 · Any Other details C24:O24

**Line items** (from row 31): Sl No. (A) · Description (B:E) · Part No./Ref.No.
(F:G) · QTY Requested (H) · UOM (I) · ROB (J) · Remarks (K:N) · Supporting
Photos (O)

**SUPPORTING PHOTOS table:** Sl.No. (A), Photo 1–7 across B:C, D:E, F:G, H:I,
J:K, L:M, N:O - 7 photos per row, 8th starts a new row for that Sl No.

**Footer:** Requisitioned by C43:G44 · Approved by K43:O44

## Diagnostic tools (Alt+F8)

- **`DiagnoseSupportingPhotosCell`** - reports the true Locked/merge/protection
  state of the current Supporting Photos cell, plus any shape overlapping it.
- **`CleanupStrayInputPictures`** - removes any leftover object sitting in the
  line-item table rows.
- **`ApplyFormProtection`** - re-asserts every input cell's correct unlocked
  state in one pass; run this first if any cell ever seems unselectable.
- **`UnmergeSupportingPhotosInputCells`** - safety net in case the Supporting
  Photos cell is ever accidentally merged; this template doesn't need it out
  of the box, but it's harmless to run and costs nothing to have available.

## Macro security warning on other machines

Same as always: anyone opening this `.xlsm` after downloading, emailing, or
receiving it via a cloud link will see Excel's hard macro block. They need to
close Excel, right-click the file → Properties → check **Unblock** → OK →
reopen → **Enable Content**.

## Test checklist

| # | Test | Expected result |
|---|---|---|
| 1 | Open the freshly set-up form | Exactly one line item, Sl No. = 1 |
| 2 | Fill in header fields and all 7 Equipment Details fields | All accept text normally |
| 3 | Paste 7 images into Sl No. 1's Supporting Photos cell | All 7 land in Photo 1–7, cell shows "7 photos" |
| 4 | Paste an 8th image | New row created for Sl No. 1, image lands in its Photo 1 |
| 5 | Click **Add Line Item** | Sl No. 2 appears; Sl No. 1 data/images untouched |
| 6 | Try clicking into the SUPPORTING PHOTOS table or the Sl No. column | Not selectable |
| 7 | Enter an invalid date | Rejected by Excel's native validation |
| 8 | Leave every field blank, click Add Line Item | New row is still created |
| 9 | Close and reopen the file | Protection and Ctrl+V still active without rerunning setup |
| 10 | Paste 3 images into Sl No. 1, click **Remove Last Photo** on its row | Photo 3 disappears, cell shows "2 photos" |
| 11 | Paste 8 images into Sl No. 1, then **Remove Last Photo** | The continuation row is deleted; Sl No. 1 has 7 photos, cell shows "7 photos" |
| 12 | With photos on Sl No. 1 and 2, **Remove All Photos** on Sl No. 1 and confirm | Sl No. 1's photo rows are gone, Sl No. 2's photos and row are intact |
| 13 | Click **Add Line Item** | The new row has its own three Remove buttons |
| 14 | With 3 line items that each have photos, **Remove Line Item** on Sl No. 2 and confirm | Two line items numbered 1 and 2; the old Sl No. 3 is now 2 and keeps its photos; no buttons left behind |
| 15 | **Remove Line Item** on the only line item | Message that it can't be removed; nothing changes |
| 16 | Copy image file(s) in File Explorer, click a Supporting Photos cell, Ctrl+V | Every image is filed (non-images skipped) |
