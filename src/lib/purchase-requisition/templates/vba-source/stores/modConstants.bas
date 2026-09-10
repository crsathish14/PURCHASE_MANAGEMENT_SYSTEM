Attribute VB_Name = "modConstants"
Option Explicit

'===================================================================
' modConstants
' All configuration values live here. Nothing below should ever be
' hard-coded again elsewhere in the project - change it here once.
'
' Rebuilt for the "Stores Requisition Form" template (v2). If the
' template is ever revised again, this is the ONLY module that
' should need new addresses/columns - every other module locates
' things dynamically (by label search, or relative to these
' constants) rather than hard-coding row/column numbers itself.
'===================================================================

' --- Sheet / protection ---
Public Const SHEET_NAME As String = "Stores Requisition Form"
Public Const PROTECT_PASSWORD As String = "Req2026!"   ' <-- change before deployment

' --- Requisitioner ("TO BE FILLED BY REQUISITIONER") table ---
' Row 22 is fixed forever: nothing is ever inserted above it, so it
' never shifts, unlike every other anchor in this workbook.
Public Const LINEITEM_FIRST_ROW As Long = 22
Public Const COL_SLNO As Long = 1      ' Column A - Sl No. (line items AND photo table)
Public Const COL_PHOTOS As Long = 14   ' Column N - Supporting Photos input cell (merged N:O)

' --- "SUPPORTING PHOTOS" table ---
' The table's position moves down every time a line item is inserted
' above it, so its row is located by label search at run time
' (see modImages.GetImageTableFirstDataRow) rather than a constant.
Public Const IMG_HEADING_TEXT As String = "SUPPORTING PHOTOS"
Public Const MAX_PHOTOS_PER_ROW As Long = 7
Public Const IMG_PHOTO_COL_1 As Long = 2    ' B  (merged B:C)
Public Const IMG_PHOTO_COL_2 As Long = 4    ' D  (merged D:E)
Public Const IMG_PHOTO_COL_3 As Long = 6    ' F  (merged F:G)
Public Const IMG_PHOTO_COL_4 As Long = 8    ' H  (merged H:I)
Public Const IMG_PHOTO_COL_5 As Long = 10   ' J  (merged J:K)
Public Const IMG_PHOTO_COL_6 As Long = 12   ' L  (merged L:M)
Public Const IMG_PHOTO_COL_7 As Long = 14   ' N  (merged N:O)

' --- Add Line Item button ---
Public Const BTN_NAME As String = "btnAddLineItem"
Public Const BTN_CAPTION As String = "Add Line Item"
