Attribute VB_Name = "modImages"
Option Explicit

'===================================================================
' modImages
' Ctrl+V interception, image transfer into the "SUPPORTING PHOTOS"
' table, and the shared row-cloning helper used by both this module
' and modLineItems (so formatting/merges/row-height only ever need
' to be defined once, in the worksheet itself, and are always
' copied rather than re-created from scratch in code).
'===================================================================

' Bound to Ctrl+V via Application.OnKey (see modSecurity). This runs
' INSTEAD OF Excel's native paste for every Ctrl+V press while this
' workbook is active.
Public Sub HandlePaste()
    Dim ws As Worksheet
    Dim targetCell As Range
    Dim wasUnprotected As Boolean

    Set ws = ThisWorkbook.Worksheets(SHEET_NAME)
    If Not (ActiveSheet Is ws) Then Exit Sub
    Set targetCell = Selection.Cells(1, 1)

    On Error GoTo ErrHandler

    If IsSupportingPhotosInputCell(ws, targetCell) Then
        ' Don't pre-guess from clipboard formats (unreliable across
        ' different copy sources - Explorer, browsers, Paint, etc.
        ' all populate the clipboard slightly differently). Just
        ' attempt the paste and react to what actually shows up.
        ProcessPastedImage ws, targetCell

    ElseIf targetCell.Locked = False Then
        ' An ordinary unlocked input cell (Vessel Name, Description,
        ' Requisitioned by, etc.) - fall back to a normal values-only
        ' paste so typed-field paste keeps working as expected.
        If Not ClipboardHasPicture() Then
            Selection.PasteSpecial Paste:=xlPasteValues
        End If
        ' An image pasted here is intentionally dropped: locked
        ' cells are unreachable anyway (EnableSelection = xlUnlockedCells),
        ' so the only way to reach a "wrong" cell is an unlocked
        ' text field, and images don't belong there.
    End If

CleanExit:
    ApplyFormProtection   ' always reassert protection + selection rules, defensively
    Application.ScreenUpdating = False
    Application.ScreenUpdating = True   ' forces Excel to redraw the selection border
    DoEvents
    Exit Sub

ErrHandler:
    If Not wasUnprotected And Err.Number = 1004 Then
        wasUnprotected = True
        On Error Resume Next
        ws.Unprotect Password:=PROTECT_PASSWORD
        On Error GoTo ErrHandler
        Resume
    Else
        MsgBox "Paste could not be completed: " & Err.Description, vbExclamation
        Resume CleanExit
    End If
End Sub

Private Function IsSupportingPhotosInputCell(ws As Worksheet, targetCell As Range) As Boolean
    Dim lastRow As Long
    lastRow = GetLastLineItemRow(ws)
    IsSupportingPhotosInputCell = (targetCell.Column = COL_PHOTOS) And _
        (targetCell.Row >= LINEITEM_FIRST_ROW) And (targetCell.Row <= lastRow)
End Function

Private Function ClipboardHasPicture() As Boolean
    Dim formats As Variant, i As Long
    On Error Resume Next
    formats = Application.ClipboardFormats
    On Error GoTo 0

    If Not IsArray(formats) Then Exit Function
    If UBound(formats) < LBound(formats) Then Exit Function

    For i = LBound(formats) To UBound(formats)
        Select Case formats(i)
            Case xlClipboardFormatBitmap, xlClipboardFormatPICT
                ClipboardHasPicture = True
                Exit Function
        End Select
    Next i
End Function

' Returns the 7 photo-slot anchor columns as an array, in order.
' Centralized here so every caller stays in sync if the template
' ever changes the number of slots again - only modConstants and
' this one function would need to change.
Private Function PhotoSlotColumns() As Variant
    PhotoSlotColumns = Array(IMG_PHOTO_COL_1, IMG_PHOTO_COL_2, IMG_PHOTO_COL_3, IMG_PHOTO_COL_4, _
                              IMG_PHOTO_COL_5, IMG_PHOTO_COL_6, IMG_PHOTO_COL_7)
End Function

' Pastes the clipboard image, files it into the correct slot of the
' SUPPORTING PHOTOS table for this line item's Sl No., and leaves the
' Supporting Photos input cell clean (the picture is MOVED, not
' copied, so there is nothing left behind to remove separately).
Private Sub ProcessPastedImage(ws As Worksheet, inputCell As Range)
    Dim slNo As Variant
    Dim shp As Shape
    Dim destCell As Range
    Dim countBefore As Long
    Dim pasteErrNum As Long
    Dim pasteErrDesc As String
    Dim i As Long

    countBefore = ws.Shapes.Count

    ' Use Pictures.Paste rather than Worksheet.Paste. Worksheet.Paste
    ' pastes at the CURRENT SELECTION, which runs into two separate
    ' Excel restrictions here: (1) Excel refuses to paste an object
    ' onto a merged cell ("We can't do that to a merged cell") - the
    ' Supporting Photos input cell is merged (N:O) in this template -
    ' and (2) EnableSelection = xlUnlockedCells blocks selecting a
    ' locked cell even from VBA, which broke an earlier attempt to
    ' work around (1) by staging the paste on a scratch cell.
    ' Pictures.Paste sidesteps both: it adds the clipboard picture
    ' directly to the worksheet without depending on, or changing,
    ' the current selection at all.
    On Error Resume Next
    inputCell.ClearContents   ' in case a previous failed attempt left text behind
    ws.Pictures.Paste
    pasteErrNum = Err.Number
    pasteErrDesc = Err.Description
    On Error GoTo 0

    ' Check whether a picture actually landed BEFORE treating this as
    ' a failure. Pictures.Paste can raise the merged-cell error (1004)
    ' as a side effect of the active cell still sitting on the merged
    ' Supporting Photos cell, even though the picture itself is
    ' successfully added regardless - so a reported error alongside a
    ' real new shape is spurious and should be ignored, not fatal.
    If ws.Shapes.Count <= countBefore Then
        If inputCell.Value <> "" Then inputCell.ClearContents
        If pasteErrNum <> 0 Then
            MsgBox "The paste failed with error " & pasteErrNum & ": " & pasteErrDesc & vbCrLf & vbCrLf & _
                   "Copy the image itself, then click this cell and press Ctrl+V again.", vbExclamation
        Else
            MsgBox "That didn't paste as an image. Make sure you copied the picture itself " & _
                   "(not a file name/icon or a link), then click this cell and press Ctrl+V again.", _
                   vbExclamation
        End If
        Exit Sub
    End If

    ' A single paste can add MORE THAN ONE object - e.g. copying an
    ' image FILE (rather than raw picture data) can make Excel paste
    ' an embedded file object alongside a separate picture preview.
    ' Find the real picture among everything that was just added, and
    ' delete every other new object so nothing is left sitting behind
    ' (an untouched leftover object here is exactly what would make
    ' this cell look permanently unselectable afterward).
    Set shp = Nothing
    For i = ws.Shapes.Count To countBefore + 1 Step -1
        If (ws.Shapes(i).Type = msoPicture Or ws.Shapes(i).Type = msoLinkedPicture) And shp Is Nothing Then
            Set shp = ws.Shapes(i)
        Else
            ws.Shapes(i).Delete
        End If
    Next i

    If shp Is Nothing Then
        MsgBox "Only images can be pasted into the Supporting Photos cell.", vbExclamation
        Exit Sub
    End If

    slNo = ws.Cells(inputCell.Row, COL_SLNO).Value
    If slNo = "" Then
        shp.Delete
        MsgBox "This line item has no Sl No. yet - the image could not be filed.", vbCritical
        Exit Sub
    End If

    Set destCell = GetNextImageSlot(ws, CLng(slNo))

    FitPictureToCell shp, destCell
    shp.Left = destCell.Left + (destCell.Width - shp.Width) / 2
    shp.Top = destCell.Top + (destCell.Height - shp.Height) / 2
    shp.Placement = xlMoveAndSize   ' shifts correctly if rows are inserted above it later

    ' Show a running count of photos filed for this line item so the
    ' client can see at a glance how many have been added.
    Dim totalCount As Long
    totalCount = CountImagesForSL(ws, CLng(slNo))
    inputCell.Value = totalCount & IIf(totalCount = 1, " photo", " photos")

    ' Explicitly return focus to the input cell itself. Excel makes a
    ' freshly-pasted picture the active selection, and without this,
    ' the "selection" stays on that (now relocated) shape rather than
    ' snapping back to a cell - which can make the input cell look/act
    ' unselectable until something else forces a fresh click through.
    inputCell.Select
End Sub

' Counts how many images have been filed under a given Sl No. across
' every SUPPORTING PHOTOS row that belongs to it (there may be more
' than one row once a line item has more than 7 photos).
Private Function CountImagesForSL(ws As Worksheet, slNo As Long) As Long
    Dim templateRow As Long, r As Long, cnt As Long
    Dim slotCols As Variant, i As Long

    templateRow = GetImageTableFirstDataRow(ws)
    slotCols = PhotoSlotColumns()

    r = templateRow
    Do While ws.Cells(r, COL_SLNO).Value <> ""
        If ws.Cells(r, COL_SLNO).Value = slNo Then
            For i = 0 To UBound(slotCols)
                If Not IsSlotEmpty(ws, r, slotCols(i)) Then cnt = cnt + 1
            Next i
        End If
        r = r + 1
    Loop

    CountImagesForSL = cnt
End Function

' Resizes a shape to fit inside destCell while preserving its
' original aspect ratio (never distorted, never overflowing).
Private Sub FitPictureToCell(shp As Shape, destCell As Range)
    Dim availW As Double, availH As Double, picRatio As Double
    Const PAD As Double = 2

    availW = destCell.Width - PAD * 2
    availH = destCell.Height - PAD * 2
    If availW <= 0 Then availW = destCell.Width
    If availH <= 0 Then availH = destCell.Height

    picRatio = shp.Width / shp.Height

    If (availW / availH) > picRatio Then
        shp.Height = availH
        shp.Width = availH * picRatio
    Else
        shp.Width = availW
        shp.Height = availW / picRatio
    End If
End Sub

' Finds the "SUPPORTING PHOTOS" heading by label search (its row
' moves down every time a line item is inserted above it, so it is
' located fresh every time rather than assumed from a constant), then
' walks past the heading's own row-span and the column-header block's
' row-span - both read from their actual merge sizes rather than
' assumed - to find the first real data row. This avoids hard-coding
' an offset that would silently break if a future template revision
' changes how many rows the heading or header block occupies (the
' heading went from 1 row to 2 between the first and second template
' revisions of this project, which is exactly the kind of change this
' is written to survive automatically).
Private Function GetImageTableFirstDataRow(ws As Worksheet) As Long
    Dim headingRow As Long, headingSpan As Long
    Dim headerRow As Long, headerSpan As Long

    headingRow = FindRowByLabel(ws, IMG_HEADING_TEXT)
    If headingRow = 0 Then
        Err.Raise vbObjectError + 1, , "Could not locate the '" & IMG_HEADING_TEXT & "' heading."
    End If
    headingSpan = ws.Cells(headingRow, COL_SLNO).MergeArea.Rows.Count

    headerRow = headingRow + headingSpan
    headerSpan = ws.Cells(headerRow, COL_SLNO).MergeArea.Rows.Count

    GetImageTableFirstDataRow = headerRow + headerSpan
End Function

Public Function FindRowByLabel(ws As Worksheet, searchText As String) As Long
    Dim r As Long, lastR As Long
    lastR = ws.UsedRange.Row + ws.UsedRange.Rows.Count - 1
    For r = 1 To lastR
        If InStr(1, CStr(ws.Cells(r, COL_SLNO).Value), searchText, vbTextCompare) > 0 Then
            FindRowByLabel = r
            Exit Function
        End If
    Next r
End Function

' Returns the next free Photo-N cell for this Sl No., creating a new
' continuation row (same Sl No.) if the current last row for that Sl
' No. is already full of MAX_PHOTOS_PER_ROW photos. Works correctly
' even if the client goes back and adds more photos to an earlier Sl
' No. after later Sl numbers already have rows of their own - the new
' row is inserted right after that Sl No.'s own last row, not simply
' appended to the end of the table.
Private Function GetNextImageSlot(ws As Worksheet, slNo As Long) As Range
    Dim templateRow As Long, r As Long, lastMatchRow As Long, endRow As Long
    Dim slotCols As Variant, i As Long

    templateRow = GetImageTableFirstDataRow(ws)
    slotCols = PhotoSlotColumns()

    lastMatchRow = 0
    r = templateRow
    Do While ws.Cells(r, COL_SLNO).Value <> ""
        If ws.Cells(r, COL_SLNO).Value = slNo Then lastMatchRow = r
        r = r + 1
    Loop
    endRow = r   ' first fully blank row right after the table

    If lastMatchRow = 0 Then
        lastMatchRow = CreateImageRow(ws, endRow, templateRow, slNo)
    ElseIf Not RowHasFreeSlot(ws, lastMatchRow, slotCols) Then
        lastMatchRow = CreateImageRow(ws, lastMatchRow + 1, templateRow, slNo)
    End If

    For i = 0 To UBound(slotCols)
        If IsSlotEmpty(ws, lastMatchRow, slotCols(i)) Then
            Set GetNextImageSlot = ws.Cells(lastMatchRow, slotCols(i))
            Exit Function
        End If
    Next i
End Function

Private Function RowHasFreeSlot(ws As Worksheet, r As Long, slotCols As Variant) As Boolean
    Dim i As Long
    For i = 0 To UBound(slotCols)
        If IsSlotEmpty(ws, r, slotCols(i)) Then
            RowHasFreeSlot = True
            Exit Function
        End If
    Next i
End Function

' A "slot" is occupied if a picture's top-left corner already sits
' in that cell - cell VALUES are never used for this (images don't
' set cell values), so the Shapes collection is the source of truth.
Private Function IsSlotEmpty(ws As Worksheet, r As Long, ByVal c As Long) As Boolean
    Dim shp As Shape
    IsSlotEmpty = True
    For Each shp In ws.Shapes
        If shp.Type = msoPicture Or shp.Type = msoLinkedPicture Then
            If Not shp.TopLeftCell Is Nothing Then
                If shp.TopLeftCell.Row = r And shp.TopLeftCell.Column = c Then
                    IsSlotEmpty = False
                    Exit Function
                End If
            End If
        End If
    Next shp
End Function

' Creates a new SUPPORTING PHOTOS row for slNo at insertAtRow. If
' insertAtRow IS the table's still-empty first data row, it is used
' directly (no insert needed); otherwise a formatted row is cloned
' and inserted there, pushing the footer section further down.
Private Function CreateImageRow(ws As Worksheet, insertAtRow As Long, templateRow As Long, slNo As Long) As Long
    If insertAtRow = templateRow And ws.Cells(templateRow, COL_SLNO).Value = "" Then
        ws.Cells(templateRow, COL_SLNO).Value = slNo
        CreateImageRow = templateRow
    Else
        InsertFormattedRow ws, templateRow, insertAtRow
        ws.Cells(insertAtRow, COL_SLNO).Value = slNo
        CreateImageRow = insertAtRow
    End If
End Function

' Shared helper (also used by modLineItems.AddLineItem): clones a
' template row's formatting/merges/row-height into a brand-new row
' at targetRow, shifting everything below it down by one row.
'
' IMPORTANT: this inserts a genuinely BLANK row first, then pastes
' only the FORMATTING from the template row onto it - it never does
' a plain "copy row, insert copied cells". That distinction matters:
' many Excel installs have "Cut, copy, and sort inserted objects
' with their parent cells" turned on (Options > Advanced), which
' makes a full row copy drag along any floating picture that visually
' overlaps that row - even in a different column - and can leave the
' protection/selection state on the affected cells in a confused
' state. A Formats-only paste is scoped to cell formatting alone
' (including merges, borders, row height, and locked status) and
' never touches shapes or values, so this sidesteps that entirely.
Public Sub InsertFormattedRow(ws As Worksheet, templateRow As Long, targetRow As Long)
    ws.Rows(targetRow).Insert Shift:=xlDown   ' blank row - nothing pending on the clipboard yet
    ws.Rows(templateRow).Copy
    ws.Rows(targetRow).PasteSpecial Paste:=xlPasteFormats
    Application.CutCopyMode = False

    ' Formats-only paste is documented to carry merged-cell state along
    ' with borders/fonts/etc., but replicate it explicitly too as a
    ' belt-and-suspenders safeguard - the merged spans (Description,
    ' ROB, or the wide photo slots) are critical to the form's layout
    ' and must never silently fail to appear on a new row.
    ReplicateRowMerges ws, templateRow, targetRow
End Sub

' Walks templateRow's columns and reproduces the exact same merged
' spans on targetRow, whatever they are - this is generic on purpose
' so it works identically for line-item rows (Description/IMPA Code/
' Remarks) and SUPPORTING PHOTOS rows (the wide photo slots) without
' either pattern being hard-coded here.
Private Sub ReplicateRowMerges(ws As Worksheet, templateRow As Long, targetRow As Long)
    Dim lastCol As Long, c As Long, span As Long
    Dim srcCell As Range

    lastCol = ws.UsedRange.Column + ws.UsedRange.Columns.Count - 1

    c = 1
    Do While c <= lastCol
        Set srcCell = ws.Cells(templateRow, c)
        If srcCell.MergeCells And srcCell.Address = srcCell.MergeArea.Cells(1, 1).Address Then
            span = srcCell.MergeArea.Columns.Count
            If ws.Cells(targetRow, c).MergeCells Then ws.Cells(targetRow, c).UnMerge
            ws.Range(ws.Cells(targetRow, c), ws.Cells(targetRow, c + span - 1)).Merge
            c = c + span
        Else
            c = c + 1
        End If
    Loop
End Sub

' ONE-TIME DIAGNOSTIC/CLEANUP - run this manually from Alt+F8 (or F5 in the
' VBA editor with the cursor inside it) if a Supporting Photos cell becomes
' unselectable. This can happen if a picture was ever pasted while the
' project had a compile error (a broken project can't run HandlePaste, so
' Ctrl+V falls back to Excel's plain default paste, leaving a raw,
' unprocessed picture sitting on top of the input cell - which then
' intercepts clicks meant for the cell underneath it). Deletes any
' object whose top-left corner sits in the Supporting Photos column
' within the line-item range; legitimate images are never supposed to
' remain there, so this is always safe to run.
Public Sub CleanupStrayInputPictures()
    Dim ws As Worksheet
    Dim shp As Shape
    Dim i As Long, lastRow As Long, removed As Long

    Set ws = ThisWorkbook.Worksheets(SHEET_NAME)
    lastRow = GetLastLineItemRow(ws)

    For i = ws.Shapes.Count To 1 Step -1
        Set shp = ws.Shapes(i)
        If Not shp.TopLeftCell Is Nothing Then
            ' Any column, not just Supporting Photos - a botched paste
            ' can land anywhere within the line-item table's rows, and
            ' nothing should ever legitimately have a floating object
            ' anchored there (real photos always live in the
            ' SUPPORTING PHOTOS table further down).
            If shp.TopLeftCell.Row >= LINEITEM_FIRST_ROW And shp.TopLeftCell.Row <= lastRow Then
                shp.Delete   ' any object type - pictures, embedded files, etc.
                removed = removed + 1
            End If
        End If
    Next i

    MsgBox removed & " stray object(s) removed from the line-item table.", vbInformation
End Sub

' DIAGNOSTIC - run this manually (Alt+F8) any time the Supporting
' Photos cell seems unselectable. Reports the cell's real Locked/
' merge/protection state directly (it doesn't rely on what's
' currently selected), plus any shape whose bounding box overlaps
' that cell at all - even if it isn't anchored there (a shape can
' visually cover a cell without its TopLeftCell matching it).
Public Sub DiagnoseSupportingPhotosCell()
    Dim ws As Worksheet
    Dim r As Long
    Dim targetCell As Range
    Dim msg As String
    Dim shp As Shape
    Dim overlapCount As Long

    Set ws = ThisWorkbook.Worksheets(SHEET_NAME)
    r = GetLastLineItemRow(ws)
    Set targetCell = ws.Cells(r, COL_PHOTOS)

    msg = "Checking " & targetCell.Address & " (last line item row, Sl No. " & _
          ws.Cells(r, COL_SLNO).Value & "):" & vbCrLf
    msg = msg & "Locked = " & targetCell.Locked & vbCrLf
    msg = msg & "MergeCells = " & targetCell.MergeCells & vbCrLf
    msg = msg & "Sheet ProtectContents = " & ws.ProtectContents & vbCrLf
    msg = msg & "Sheet EnableSelection = " & ws.EnableSelection & _
          " (1 = xlUnlockedCells, the expected value)" & vbCrLf
    msg = msg & vbCrLf & "Shapes overlapping this cell's area:" & vbCrLf

    overlapCount = 0
    For Each shp In ws.Shapes
        If RectsOverlap(shp.Left, shp.Top, shp.Width, shp.Height, _
                         targetCell.Left, targetCell.Top, targetCell.Width, targetCell.Height) Then
            overlapCount = overlapCount + 1
            msg = msg & "- " & shp.Name & " (Type=" & shp.Type & "), anchored at " & _
                  shp.TopLeftCell.Address & vbCrLf
        End If
    Next shp
    If overlapCount = 0 Then msg = msg & "(none)" & vbCrLf

    MsgBox msg, vbInformation, "Supporting Photos Cell Diagnostic"
End Sub

Private Function RectsOverlap(ByVal l1 As Double, ByVal t1 As Double, ByVal w1 As Double, ByVal h1 As Double, _
                               ByVal l2 As Double, ByVal t2 As Double, ByVal w2 As Double, ByVal h2 As Double) As Boolean
    RectsOverlap = Not (l1 + w1 <= l2 Or l2 + w2 <= l1 Or t1 + h1 <= t2 Or t2 + h2 <= t1)
End Function
