# Stores Requisition Form — VBA Build & Setup Guide (v2)

This replaces the earlier guide. It's rebuilt for your revised template
(`Stores Requisition Form Template.xlsx`), and folds in every fix made
during testing of v1: the row-cloning rewrite, self-healing cell locks,
the photo counter, and the diagnostic tools.

**Do not mix v1 and v2 files.** Remove any v1 modules before importing
these - the constants (columns, sheet name) are different and the two
won't work together.

## Files in this delivery

| File | What it is |
|---|---|
| `Stores Requisition Form Template.xlsx` | Your corrected layout, with date validation and correct unlocked cells applied. Not yet macro-enabled. |
| `modConstants.bas` | All configuration values - sheet name, columns, photo limit, etc. |
| `modSetup.bas` | One-time `RunInitialSetup` routine + button creation (Add Line Item and the per-line-item Remove buttons); `AddRowButtons` for already-set-up templates |
| `modSecurity.bas` | Protection settings, self-healing cell unlocking, Ctrl+V key binding |
| `modLineItems.bas` | `AddLineItem` (the button's logic) + creation/cleanup of each line item row's Remove buttons |
| `modImages.bas` | Paste detection, photo filing logic, photo and line-item removal (`RemoveLastPhoto` / `RemoveAllPhotos` / `RemoveLineItem`), diagnostics |
| `modClipboardFile.bas` | Win32 clipboard helper: lets Ctrl+V file photos copied as *files* in File Explorer (one or several), not just image data |
| `ThisWorkbook_code.txt` | Code to paste into the `ThisWorkbook` object - unchanged from v1 |

## What changed in this template vs. the original

- Sheet renamed to **"Stores Requisition Form"**.
- New **Supply Port** header field.
- Line-item columns reordered/reshaped: Sl No. (A) · Description (B:E) ·
  IMPA/ISSA Code (F:G) · QTY Requested (H) · UOM (I) · ROB (J) · Remarks
  (K:M) · Supporting Photos (N:O).
- Output table renamed **"SUPPORTING PHOTOS"**, now **7 photo slots per
  row** (was 5) - confirmed with you directly, since the original spec
  was explicit about 5 and the new layout visibly changed that.
- Footer relabeled ("Requisitioned by:" / "Approved by:"), and both
  input boxes now come properly pre-merged in your template (v1 needed
  a manual border fix for this - not needed here).

Everything else - the overall workflow, protection strategy, and every
bug fix from v1 testing - carries over unchanged, because almost the
entire codebase locates things dynamically (by label search, or
relative to the constants) rather than hard-coding row/column numbers.
Only `modConstants.bas` and the cell-address list inside
`EnsureInputCellsUnlocked` (in `modSecurity.bas`) actually needed
rewriting for the new layout.

One robustness improvement made along the way: the routine that finds
the SUPPORTING PHOTOS table now reads the heading's and header's actual
row-heights from their merged spans, instead of assuming a fixed offset.
Your original template's heading was 1 row tall; this one is 2. The old
hard-coded assumption would have silently pointed at the wrong row -
this is fixed generically, so a future layout tweak like this won't
break it again.

## Setup (same process as before)

1. Open `Stores Requisition Form Template.xlsx` → **File → Save As** →
   **Excel Macro-Enabled Workbook (\*.xlsm)**.
2. **Alt+F11** → **Import File** each `.bas` module. Paste
   `ThisWorkbook_code.txt` into the `ThisWorkbook` object directly
   (don't import it - it's not a standard module).
3. Run **`RunInitialSetup`** once (F5, or Alt+F8). Confirms the prompt,
   collapses the 3 template rows to 1, creates the button, protects the
   sheet.
4. Save, close, reopen once to confirm protection and Ctrl+V survive a
   real session, then hand off.

**Updating a template that was already set up** (it has the Add Line Item
button but not the per-line-item Remove buttons): replace the `modConstants`,
`modSetup`, `modImages` and `modLineItems` code with the new versions, then
run **`AddRowButtons`** once (Alt+F8) and save. Do not re-run
`RunInitialSetup` for this.

## Adding photos (Ctrl+V)

Click a line item's Supporting Photos cell and press Ctrl+V. Two ways to get a
photo onto the clipboard both work:

- **Open the image, right-click, Copy** - the picture data is pasted.
- **Select image file(s) in File Explorer and Ctrl+C** - the files are loaded
  from disk. Select several at once and every image is filed (non-image files in
  the selection are skipped; files that fail to load are listed in one message).

## Removing photos and line items

Pictures are floating shapes and the sheet is protected, so the client cannot
select or delete them. Every line item row therefore has three small buttons
in the columns just right of the table (column P onward; they are not
printed). Each acts on **its own row**:

- **Remove Last Photo** - removes the most recently filed photo of that line
  item (like an undo for the last Ctrl+V). No confirmation.
- **Remove All Photos** - removes every photo of that line item, after a
  Yes/No confirmation showing how many will go.
- **Remove Line Item** - removes the line item, its photos and its photo-table
  rows, after a Yes/No confirmation, then renumbers every later Sl No. down by
  one in **both** tables so photos stay matched to their line item. The only
  remaining line item can't be removed.

The buttons find their row from their own position (`Application.Caller`), so
the client doesn't need to select anything first. `AddLineItem` creates a set
for each new row; removing a line item deletes its set, and the buttons below
move up with their rows. If a macro is run from Alt+F8 instead, it uses the
active cell's row.

Photo removal deletes a photo row that becomes empty (never just blanks its
Sl No. - every scan in `modImages` stops at the first blank Sl No., so a blank
row mid-table would hide the rows below it), keeps the table's only data row
as the formatting template, and refreshes the "N photos" counter.

## If something looks broken again

Two diagnostic tools are built in (Alt+F8 to run either):

- **`DiagnoseSupportingPhotosCell`** - reports the true Locked/merge/
  protection state of the last line item's Supporting Photos cell, and
  lists any shape geometrically overlapping it - directly, without
  depending on what's currently selected.
- **`CleanupStrayInputPictures`** - removes any leftover object sitting
  in the Supporting Photos column, which can happen if a paste ever
  went through while the VBA project had a compile error (a broken
  project can't run `HandlePaste`, so Ctrl+V falls back to Excel's
  plain default paste and leaves the picture where it landed instead of
  filing it away).

If a Supporting Photos cell ever becomes unselectable, run
`ApplyFormProtection` from Alt+F8 first - it re-asserts the correct
unlocked state on every input cell in one pass and usually fixes it
immediately.

## Macro security warning on other machines

Anyone you send the `.xlsm` to will likely see **"Microsoft has blocked
macros from running because the source of this file is untrusted"** -
this is standard Windows/Office behavior for any macro file that
arrives via email, chat, or a cloud link, not a problem with the file.
They need to: close Excel → right-click the downloaded file → Properties
→ check **Unblock** → OK → reopen → **Enable Content**. This applies to
every new recipient, not just the first one.

## Test checklist

Same as before, adjusted for the new capacity:

| # | Test | Expected result |
|---|---|---|
| 1 | Open the freshly set-up form | Exactly one line item, Sl No. = 1 |
| 2 | Type into every input field, including Supply Port | All accept text normally |
| 3 | Paste 7 images into Sl No. 1's Supporting Photos cell | All 7 land in that Sl No.'s row (Photo 1–7), cell shows "7 photos" |
| 4 | Paste an 8th image | A new row is created for Sl No. 1, image lands in its Photo 1 |
| 5 | Click **Add Line Item** | Sl No. 2 appears; Sl No. 1 data/images untouched |
| 6 | Try clicking into the SUPPORTING PHOTOS table or the Sl No. column | Not selectable |
| 7 | Enter an invalid date | Rejected by Excel's native validation |
| 8 | Leave every field blank, click Add Line Item | New row is still created |
| 9 | Close and reopen the file | Protection and Ctrl+V still active without rerunning setup |
| 10 | Paste 3 images into Sl No. 1, click **Remove Last Photo** on its row | Photo 3 disappears, cell shows "2 photos" |
| 11 | Paste 8 images into Sl No. 1, then **Remove Last Photo** | The continuation row is deleted; Sl No. 1 has 7 photos, cell shows "7 photos" |
| 12 | With photos on Sl No. 1 and 2, **Remove All Photos** on Sl No. 1 and confirm | Sl No. 1's photo rows are gone, Sl No. 2's photos and row are intact, Sl No. 1's counter is blank |
| 13 | **Remove All Photos** on the only line item that has photos | Photo table returns to its empty state; pasting a new photo works and is filed correctly |
| 14 | Remove a photo from Sl No. 1, then paste a new one | New photo fills the freed slot, counter correct |
| 15 | Click **Add Line Item** | The new row has its own three Remove buttons |
| 16 | With 3 line items that each have photos, **Remove Line Item** on Sl No. 2 and confirm | Two line items, numbered 1 and 2; the old Sl No. 3 is now 2 and keeps its photos and "N photos" text; no buttons left behind; Add Line Item moved up one row |
| 17 | **Remove Line Item** on Sl No. 1 | The remaining item becomes Sl No. 1 and keeps its photos |
| 18 | **Remove Line Item** on the only line item | Message that it can't be removed; nothing changes |
| 19 | Click **Add Line Item** after removals | Numbering continues from the last Sl No.; new row has buttons |
| 20 | Copy ONE image file in File Explorer (path containing spaces), click a Supporting Photos cell, Ctrl+V | The photo is filed in Photo 1; cell shows "1 photo" |
| 21 | In File Explorer select 3 images plus 1 non-image file (e.g. a .txt), Ctrl+C, Ctrl+V | The 3 images are filed (in Explorer's order); the .txt is ignored |
| 22 | Copy an image file whose name has accented/non-English characters, then Ctrl+V | Filed normally |
| 23 | Open an image, right-click, Copy, Ctrl+V | Still filed (image-data paste) |
