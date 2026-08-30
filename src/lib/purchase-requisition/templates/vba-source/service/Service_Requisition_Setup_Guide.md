# Service Requisition Form — VBA Build & Setup Guide

Third independent form in this project (after Stores and Spares) — separate
workbook, separate worksheet name, separate constants, no shared state.

## Files in this delivery

| File | What it is |
|---|---|
| `Service Requisition Form Template.xlsx` | Template with the accidental "Chart1" sheet removed, date validation added, correct cells unlocked. Not yet macro-enabled. |
| `modConstants.bas` | Configuration values for this form |
| `modSetup.bas` | One-time `RunInitialSetup` + button creation |
| `modSecurity.bas` | Protection, self-healing unlock list (Equipment Details + this table's 4 input columns), Ctrl+V binding, and the deferred date-paste-validation fix |
| `modLineItems.bas` | Identical to Stores/Spares - never referenced a hard-coded address |
| `modImages.bas` | Identical to Spares' final version - paste detection, photo filing, all diagnostics |
| `modClipboardFile.bas` | Identical - Win32 clipboard file-path reader, no form-specific logic |
| `ThisWorkbook_code.txt` | Identical |
| `ServiceRequisitionFormSheet_code.txt` | **New file type for this project** - goes in the worksheet's own code module (not a standard module), catches invalid pasted dates |

## What's actually different here

The requisition table itself is simpler than Spares' - just four input columns
instead of six (no Part No./Ref.No., QTY, UOM, or ROB):

| Field | Column(s) |
|---|---|
| Sl No. | A |
| Description | B:H |
| Spares/Consumables required – Available onboard (Y/N) | I:J (plain text, no validation, per your instruction) |
| Remarks | K:N |
| Supporting Photos | O (single column) |

This table's header also spans **3 rows** (29:31) rather than the usual 2, which
pushes the first line-item row to **32** instead of 31. Nothing needed to change
in the code for this - `GetImageTableFirstDataRow` (in modImages) already
measures the SUPPORTING PHOTOS table's actual heading/header height from its
real merged spans rather than assuming a fixed offset, specifically because an
earlier template revision changed this exact thing on the Stores form.

Equipment Details sits at the same rows (20-24) as the Spares form, unlocked
the same way.

## Setup

1. Open the template → **File → Save As** → **Excel Macro-Enabled Workbook (\*.xlsm)**.
2. **Alt+F11** → **Import File** each `.bas` module (`modConstants`, `modSetup`,
   `modSecurity`, `modLineItems`, `modImages`, `modClipboardFile`).
3. Paste `ThisWorkbook_code.txt` into the **ThisWorkbook** object.
4. Paste `ServiceRequisitionFormSheet_code.txt` into the **"Service Requisition
   Form"** sheet's own code module (double-click the sheet name itself in the
   Project pane - not a standard module, not ThisWorkbook).
5. **Debug → Compile VBAProject** - confirm clean.
6. Run **`RunInitialSetup`** once (Alt+F8).
7. Save, close, reopen once to confirm everything survives a real session.

## Diagnostic tools (Alt+F8)

Same as the other two forms: `DiagnoseSupportingPhotosCell`,
`CleanupStrayInputPictures`, `ApplyFormProtection` (re-run to instantly fix an
unselectable input cell), `UnmergeSupportingPhotosInputCells` (safety net,
shouldn't be needed - this template's Photos column is already unmerged).

## Test checklist

| # | Test | Expected result |
|---|---|---|
| 1 | Open the freshly set-up form | Exactly one line item, Sl No. = 1 |
| 2 | Fill in header fields and all 7 Equipment Details fields | All accept text normally |
| 3 | Type text into the Y/N column | Accepted, no validation applied |
| 4 | Type an invalid date, then paste an invalid date | Both rejected with a clean message box |
| 5 | Paste 7 images into Sl No. 1's Supporting Photos cell | All 7 land correctly, cell shows "7 photos" |
| 6 | Paste an 8th image | New row created for Sl No. 1 |
| 7 | Click **Add Line Item** | Sl No. 2 appears; Sl No. 1 untouched |
| 8 | Try clicking into SUPPORTING PHOTOS or the Sl No. column | Not selectable |
| 9 | Close and reopen | Protection and Ctrl+V still active |
