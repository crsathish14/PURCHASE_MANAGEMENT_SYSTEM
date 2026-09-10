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
