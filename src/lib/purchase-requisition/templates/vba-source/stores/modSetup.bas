Attribute VB_Name = "modSetup"
Option Explicit

'===================================================================
' modSetup
' RunInitialSetup is a ONE-TIME, manually-triggered routine (run it
' yourself from the VBA editor - it is NOT wired to Workbook_Open,
' so opening the finished file never re-runs it and never touches
' the client's data). It:
'   1. Collapses the template's 3 pre-built blank line-item rows
'      down to exactly 1 (Sl No. = 1).
'   2. Creates the "Add Line Item" button.
'   3. Applies worksheet + workbook protection.
' Run this once on a fresh copy of the template, save, then hand
' the file to the client.
'===================================================================

Public Sub RunInitialSetup()
    Dim ws As Worksheet
    Dim alreadySetUp As Boolean

    Set ws = ThisWorkbook.Worksheets(SHEET_NAME)
    alreadySetUp = ButtonExists(ws, BTN_NAME)

    If alreadySetUp Then
        If MsgBox("It looks like initial setup has already been run on this sheet " & _
            "(the '" & BTN_CAPTION & "' button already exists). Running it again will " & _
            "NOT touch existing line items, but will reapply protection. Continue?", _
            vbYesNo + vbExclamation, "Setup Already Run") = vbNo Then Exit Sub
    Else
        If MsgBox("This will delete the 2 extra template line-item rows (keeping row " & _
            LINEITEM_FIRST_ROW & " as Sl No. 1), add the '" & BTN_CAPTION & "' button, " & _
            "and lock the form down. Run this only once, on a fresh copy of the template. " & _
            "Continue?", vbYesNo + vbQuestion, "Run Initial Setup") = vbNo Then Exit Sub
    End If

    On Error GoTo ErrHandler

    If ws.ProtectContents Then ws.Unprotect Password:=PROTECT_PASSWORD
    If ThisWorkbook.ProtectStructure Then ThisWorkbook.Unprotect Password:=PROTECT_PASSWORD

    If Not alreadySetUp Then
        ' Collapse the 3 pre-built blank rows to exactly 1.
        ws.Rows(CStr(LINEITEM_FIRST_ROW + 1) & ":" & CStr(LINEITEM_FIRST_ROW + 2)).Delete Shift:=xlUp
        ws.Cells(LINEITEM_FIRST_ROW, COL_SLNO).Value = 1
        CreateAddLineItemButton ws
    End If

    ApplyFormProtection

    MsgBox "Setup complete. Save the file now, then hand it to the client.", vbInformation
    Exit Sub

ErrHandler:
    MsgBox "Setup failed: " & Err.Description, vbCritical
    On Error Resume Next
    ApplyFormProtection   ' never leave the sheet unprotected after a failed setup
End Sub

' Creates (or recreates) the Add Line Item Form-Control button just
' below the single remaining line-item row.
Private Sub CreateAddLineItemButton(ws As Worksheet)
    Dim btn As Button
    Dim anchor As Range

    On Error Resume Next
    ws.Buttons(BTN_NAME).Delete
    On Error GoTo 0

    Set anchor = ws.Cells(LINEITEM_FIRST_ROW + 1, 2)   ' column B, first blank row after the table
    Set btn = ws.Buttons.Add(anchor.Left + 2, anchor.Top + 2, 130, 24)
    With btn
        .Name = BTN_NAME
        .Caption = BTN_CAPTION
        .OnAction = "AddLineItem"
        .Placement = xlMoveAndSize   ' shifts down correctly as rows are inserted above it
    End With
End Sub

Private Function ButtonExists(ws As Worksheet, btnName As String) As Boolean
    Dim b As Button
    On Error Resume Next
    Set b = ws.Buttons(btnName)
    ButtonExists = Not b Is Nothing
    On Error GoTo 0
End Function
