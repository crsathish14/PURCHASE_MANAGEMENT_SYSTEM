Attribute VB_Name = "modSecurity"
Option Explicit

'===================================================================
' modSecurity
' Central place for everything related to locking the form down.
' Same proven protection strategy as the Stores Requisition form:
'
'   - The sheet is protected with UserInterfaceOnly:=True, so VBA can
'     insert rows, write cells, and add/move pictures freely, while
'     the user is fully restricted by normal protection rules.
'     Excel forgets UserInterfaceOnly every time the file closes, so
'     ApplyFormProtection re-applies it on every Workbook_Open.
'   - DrawingObjects:=True blocks all manual picture/shape insertion
'     everywhere on the sheet; Ctrl+V is globally intercepted (see
'     BindPasteHandler) and only modImages.HandlePaste is allowed to
'     actually place a picture, only in a genuine Supporting Photos
'     input cell.
'   - EnableSelection = xlUnlockedCells means locked cells cannot be
'     selected at all.
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

' Re-asserts Locked = False on every designated input cell: header
' fields, Equipment Details, every EXISTING line-item row's input
' columns (never the Sl No. column), and the footer fields. Runs on
' every call to ApplyFormProtection (Workbook_Open, after AddLineItem,
' after every paste) so a cell's Locked status self-corrects on the
' next protection cycle if it's ever disturbed by anything.
Private Sub EnsureInputCellsUnlocked(ws As Worksheet)
    Dim r As Long, lastItemRow As Long, footerRow As Long, footerSpan As Long

    ' Header fields
    ws.Range("C12:G12").Locked = False   ' Vessel Name
    ws.Range("K12:O12").Locked = False   ' IMO No
    ws.Range("C13:G13").Locked = False   ' Date
    ws.Range("K13:O13").Locked = False   ' Requisition No
    ws.Range("C14:G14").Locked = False   ' Supply Port
    ws.Range("C17:H17").Locked = False   ' Title

    ' Equipment Details (new section for this form)
    ws.Range("C21:G21").Locked = False   ' Name of Equipment
    ws.Range("K21:O21").Locked = False   ' Type
    ws.Range("C22:G22").Locked = False   ' Make
    ws.Range("K22:O22").Locked = False   ' Sr. No.
    ws.Range("C23:G23").Locked = False   ' Model
    ws.Range("K23:O23").Locked = False   ' Specifications
    ws.Range("C24:O24").Locked = False   ' Any Other details

    lastItemRow = GetLastLineItemRow(ws)
    For r = LINEITEM_FIRST_ROW To lastItemRow
        ws.Cells(r, 2).MergeArea.Locked = False       ' Description (B:E)
        ws.Cells(r, 6).MergeArea.Locked = False       ' Part No./Ref.No. (F:G)
        ws.Cells(r, 8).Locked = False                  ' QTY Requested (H)
        ws.Cells(r, 9).Locked = False                  ' UOM (I)
        ws.Cells(r, 10).Locked = False                 ' ROB (J)
        ws.Cells(r, 11).MergeArea.Locked = False      ' Remarks (K:N)
        ws.Cells(r, COL_PHOTOS).MergeArea.Locked = False   ' Supporting Photos (O)
        ' Column A (Sl No.) is deliberately never touched here.
    Next r

    ' Footer fields move down as the tables above them grow, so they
    ' are located by label rather than a fixed row number. The row
    ' span is read from the label's own merge rather than assumed.
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
