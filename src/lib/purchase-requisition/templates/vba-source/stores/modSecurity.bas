Attribute VB_Name = "modSecurity"
Option Explicit

'===================================================================
' modSecurity
' Central place for everything related to locking the form down.
'
' Protection strategy (read this before changing anything):
'   - The sheet is protected with UserInterfaceOnly:=True. This is
'     the standard VBA technique that protects the sheet from the
'     USER (mouse/keyboard) while leaving VBA code completely free
'     to insert rows, write cells, and add/move pictures without
'     needing to manually Unprotect/Protect around every change.
'     Excel forgets the UserInterfaceOnly flag every time the file
'     is closed, so it MUST be re-applied on every Workbook_Open -
'     that is why ApplyFormProtection runs there.
'   - DrawingObjects:=True blocks ALL manual picture/shape insertion
'     (Insert > Pictures, ordinary Ctrl+V) everywhere on the sheet.
'     Excel's protection has no concept of "allow objects in this
'     one cell only" - it is all-or-nothing for the sheet. To still
'     allow the client to paste an image into the Supporting Photos
'     cell, Ctrl+V is globally intercepted (see BindPasteHandler)
'     and only modImages.HandlePaste is allowed to actually place a
'     picture, and only when the active cell is a genuine Supporting
'     Photos input cell.
'   - EnableSelection = xlUnlockedCells means locked cells cannot be
'     selected at all - the client cannot even click into the Sl No.
'     column or the SUPPORTING PHOTOS table.
'===================================================================

Public Sub ApplyFormProtection()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets(SHEET_NAME)

    ' Unprotect first (formatting changes, including Locked status,
    ' need a genuinely unprotected sheet even for VBA in some states -
    ' e.g. right after opening the file, before UserInterfaceOnly has
    ' been re-established for this session).
    If ws.ProtectContents Then
        On Error Resume Next
        ws.Unprotect Password:=PROTECT_PASSWORD
        On Error GoTo 0
    End If

    EnsureInputCellsUnlocked ws   ' self-heal, every time, regardless of how it drifted

    ws.EnableSelection = xlUnlockedCells
    ws.Protect Password:=PROTECT_PASSWORD, _
        DrawingObjects:=True, Contents:=True, Scenarios:=True, _
        UserInterfaceOnly:=True, _
        AllowFormattingCells:=False, AllowFormattingColumns:=False, AllowFormattingRows:=False, _
        AllowInsertingColumns:=False, AllowInsertingRows:=False, AllowInsertingHyperlinks:=False, _
        AllowDeletingColumns:=False, AllowDeletingRows:=False, _
        AllowSorting:=False, AllowFiltering:=False, AllowUsingPivotTables:=False

    If Not ThisWorkbook.ProtectStructure Then
        ThisWorkbook.Protect Password:=PROTECT_PASSWORD, Structure:=True
    End If
End Sub

' Re-asserts Locked = False on every designated input cell: the
' header fields, every EXISTING line-item row's input columns (never
' the Sl No. column), and the footer fields. Runs on every single
' call to ApplyFormProtection (Workbook_Open, after AddLineItem, after
' every paste) specifically so that if a cell's Locked status is ever
' disturbed by anything, it self-corrects on the very next protection
' cycle instead of silently persisting.
Private Sub EnsureInputCellsUnlocked(ws As Worksheet)
    Dim r As Long, lastItemRow As Long, footerRow As Long, footerSpan As Long

    ws.Range("C10:G10").Locked = False   ' Vessel Name
    ws.Range("K10:O10").Locked = False   ' IMO No
    ws.Range("C11:G11").Locked = False   ' Date
    ws.Range("K11:O11").Locked = False   ' Requisition No
    ws.Range("C12:G12").Locked = False   ' Supply Port
    ws.Range("C15:H15").Locked = False   ' Title

    lastItemRow = GetLastLineItemRow(ws)
    For r = LINEITEM_FIRST_ROW To lastItemRow
        ws.Cells(r, 2).MergeArea.Locked = False       ' Description (B:E)
        ws.Cells(r, 6).MergeArea.Locked = False       ' IMPA/ISSA Code (F:G)
        ws.Cells(r, 8).Locked = False                  ' QTY Requested (H)
        ws.Cells(r, 9).Locked = False                  ' UOM (I)
        ws.Cells(r, 10).Locked = False                 ' ROB (J)
        ws.Cells(r, 11).MergeArea.Locked = False      ' Remarks (K:M)
        ws.Cells(r, COL_PHOTOS).MergeArea.Locked = False   ' Supporting Photos (N:O)
        ' Column A (Sl No.) is deliberately never touched here.
    Next r

    ' Footer fields move down as the tables above them grow, so they
    ' are located by label rather than a fixed row number. The row
    ' span is read from the label's own merge rather than assumed,
    ' so this keeps working even if the footer block's height changes
    ' in a future template revision.
    footerRow = FindRowByLabel(ws, "Requisitioned")
    If footerRow > 0 Then
        footerSpan = ws.Cells(footerRow, COL_SLNO).MergeArea.Rows.Count
        ws.Range(ws.Cells(footerRow, 3), ws.Cells(footerRow + footerSpan - 1, 7)).Locked = False    ' Requisitioned by (C:G)
        ws.Range(ws.Cells(footerRow, 11), ws.Cells(footerRow + footerSpan - 1, 15)).Locked = False  ' Approved by (K:O)
    End If
End Sub

' Ctrl+V is intercepted application-wide while this workbook is the
' active one (Application.OnKey is not workbook-scoped - see
' ThisWorkbook's Activate/Deactivate handlers, which call these).
Public Sub BindPasteHandler()
    Application.OnKey "^v", "HandlePaste"
End Sub

Public Sub UnbindPasteHandler()
    Application.OnKey "^v"   ' restores Excel's native paste everywhere else
End Sub
