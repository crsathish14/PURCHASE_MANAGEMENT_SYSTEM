Attribute VB_Name = "modLineItems"
Option Explicit

'===================================================================
' modLineItems
' Everything to do with adding requisition line items.
' Fully generic against modConstants - unchanged by the template
' rebuild.
'===================================================================

' Assigned to the "Add Line Item" button. Adds exactly one new row
' immediately below the last existing line item, with the next
' sequential SL No. Never touches existing rows or their images.
Public Sub AddLineItem()
    Dim ws As Worksheet
    Dim lastRow As Long, newRow As Long, newSL As Long
    Dim wasUnprotected As Boolean

    Set ws = ThisWorkbook.Worksheets(SHEET_NAME)

    On Error GoTo ErrHandler
    lastRow = GetLastLineItemRow(ws)
    newRow = lastRow + 1
    newSL = ws.Cells(lastRow, COL_SLNO).Value + 1

    InsertFormattedRow ws, lastRow, newRow   ' see modImages - shared row-cloning helper
    ws.Cells(newRow, COL_SLNO).Value = newSL
    CreateRowButtons ws, newRow   ' this row's Remove buttons

CleanExit:
    ApplyFormProtection   ' always reassert protection + selection rules, defensively
    Exit Sub

ErrHandler:
    ' Defensive retry: if the sheet was somehow left in a plain
    ' (non-UserInterfaceOnly) protected state, unprotect once and
    ' retry, then always reprotect before leaving this procedure.
    If Not wasUnprotected And Err.Number = 1004 Then
        wasUnprotected = True
        On Error Resume Next
        ws.Unprotect Password:=PROTECT_PASSWORD
        On Error GoTo ErrHandler
        Resume
    Else
        MsgBox "Could not add a new line item: " & Err.Description, vbExclamation
        Resume CleanExit
    End If
End Sub

' Scans down the Sl No. column from the fixed first row until it
' finds the first blank cell. LINEITEM_FIRST_ROW never moves (nothing
' is ever inserted above it), so this is reliable no matter how many
' items or image rows have been added elsewhere on the sheet.
Public Function GetLastLineItemRow(ws As Worksheet) As Long
    Dim r As Long
    r = LINEITEM_FIRST_ROW
    Do While ws.Cells(r, COL_SLNO).Value <> ""
        r = r + 1
    Loop
    GetLastLineItemRow = r - 1
End Function

'===================================================================
' Per-line-item buttons
' Every line item row has three Form-Control buttons in the columns just
' to the right of the table (BTN_ROW_FIRST_COL onward): Remove Last Photo,
' Remove All Photos, Remove Line Item. They are anchored to their row
' (xlMoveAndSize), so they follow it when rows above are deleted, and the
' macros they run find "their" line item from the clicked button's own
' position (modImages.GetTargetLineItem). Buttons are not printed.
'
' Names must be unique - Application.Caller returns the name, and a
' duplicate would resolve to the wrong button - and a button's name goes
' stale as rows shift, so a row number can't be part of it.
'===================================================================

' Deletes every per-row button and recreates the set for each existing
' line item. Used by setup; AddLineItem/RemoveLineItem maintain the set
' incrementally instead (rebuilding is slow with hundreds of line items).
Public Sub RebuildRowButtons(ws As Worksheet)
    Dim i As Long, r As Long

    For i = ws.Shapes.Count To 1 Step -1
        If IsRowButtonName(ws.Shapes(i).Name) Then ws.Shapes(i).Delete
    Next i

    For r = LINEITEM_FIRST_ROW To GetLastLineItemRow(ws)
        CreateRowButtons ws, r
    Next r
End Sub

Public Sub CreateRowButtons(ws As Worksheet, ByVal r As Long)
    AddRowButton ws, r, "Last", BTN_ROW_LAST_CAPTION, "RemoveLastPhoto", 0, 84
    AddRowButton ws, r, "All", BTN_ROW_ALL_CAPTION, "RemoveAllPhotos", 87, 84
    AddRowButton ws, r, "Item", BTN_ROW_ITEM_CAPTION, "RemoveLineItem", 174, 78
End Sub

' Deletes the per-row buttons anchored in row r (called before the row
' itself is deleted, so no button is ever left orphaned).
Public Sub DeleteRowButtons(ws As Worksheet, ByVal r As Long)
    Dim i As Long

    For i = ws.Shapes.Count To 1 Step -1
        If IsRowButtonName(ws.Shapes(i).Name) Then
            If ws.Shapes(i).TopLeftCell.Row = r Then ws.Shapes(i).Delete
        End If
    Next i
End Sub

Private Sub AddRowButton(ws As Worksheet, ByVal r As Long, ByVal key As String, ByVal btnText As String, _
                         ByVal macroName As String, ByVal leftOffset As Double, ByVal btnWidth As Double)
    Dim btn As Button
    Dim btnName As String
    Static seeded As Boolean

    If Not seeded Then
        Randomize
        seeded = True
    End If
    Do
        btnName = BTN_ROW_PREFIX & key & "_" & CLng(Rnd * 2000000000#)
    Loop While ShapeExists(ws, btnName)

    ' Rows are only 15pt tall, so the buttons are small; inset by 1pt so a
    ' button lies fully inside its row (and is deleted with it).
    Set btn = ws.Buttons.Add(ws.Cells(r, BTN_ROW_FIRST_COL).Left + 4 + leftOffset, _
                             ws.Rows(r).Top + 1, btnWidth, ws.Rows(r).Height - 2)
    With btn
        .Name = btnName
        .Caption = btnText
        .OnAction = macroName
        .Font.Size = 7
        .Placement = xlMoveAndSize
        .PrintObject = False
    End With
End Sub

Private Function IsRowButtonName(ByVal shapeName As String) As Boolean
    IsRowButtonName = (Left$(shapeName, Len(BTN_ROW_PREFIX)) = BTN_ROW_PREFIX)
End Function

Private Function ShapeExists(ws As Worksheet, ByVal shapeName As String) As Boolean
    Dim s As Shape
    On Error Resume Next
    Set s = ws.Shapes(shapeName)
    ShapeExists = Not s Is Nothing
    On Error GoTo 0
End Function

