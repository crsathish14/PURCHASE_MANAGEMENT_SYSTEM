Attribute VB_Name = "modClipboardFile"
Option Explicit

'===================================================================
' modClipboardFile
' Reads a file path directly off the Windows clipboard when it holds
' a FILE REFERENCE (e.g. a file copied straight from a File Explorer
' folder listing) rather than raw image data. This is Windows-only
' and requires Excel 2010 or later (uses PtrSafe/LongPtr, which work
' correctly on both 32-bit and 64-bit Office automatically - no
' separate 32/64-bit branching needed).
'
' WHY THIS EXISTS: copying an image FILE (selecting it in a folder
' and pressing Ctrl+C) puts a file path on the clipboard, not actual
' picture data - this is true in every Windows application, not
' specific to Excel. Application.ClipboardFormats has no visibility
' into this at all (it only reports formats Excel's own Paste
' Special dialog understands), so seeing a file reference requires
' talking to the Win32 clipboard API directly.
'===================================================================

Private Declare PtrSafe Function OpenClipboard Lib "user32" (ByVal hwnd As LongPtr) As Long
Private Declare PtrSafe Function CloseClipboard Lib "user32" () As Long
Private Declare PtrSafe Function IsClipboardFormatAvailable Lib "user32" (ByVal wFormat As Long) As Long
Private Declare PtrSafe Function GetClipboardData Lib "user32" (ByVal wFormat As Long) As LongPtr
Private Declare PtrSafe Function DragQueryFileW Lib "shell32.dll" (ByVal hDrop As LongPtr, ByVal iFile As Long, ByVal lpszFile As String, ByVal cch As Long) As Long

Private Const CF_HDROP As Long = 15
Private Const MAX_PATH_LEN As Long = 260

' Returns the first file path sitting on the clipboard as a file
' reference, or "" if the clipboard doesn't currently hold one (which
' just means "fall back to a normal clipboard image-data paste" -
' this never raises an error to the caller).
Public Function GetClipboardFilePath() As String
    Dim hDropPtr As LongPtr
    Dim buf As String
    Dim charCount As Long

    On Error GoTo Fail
    GetClipboardFilePath = ""

    If IsClipboardFormatAvailable(CF_HDROP) = 0 Then Exit Function
    If OpenClipboard(0) = 0 Then Exit Function

    hDropPtr = GetClipboardData(CF_HDROP)
    If hDropPtr <> 0 Then
        buf = String(MAX_PATH_LEN, vbNullChar)
        charCount = DragQueryFileW(hDropPtr, 0, buf, MAX_PATH_LEN)
        If charCount > 0 Then GetClipboardFilePath = Left$(buf, charCount)
    End If

    CloseClipboard
    Exit Function

Fail:
    On Error Resume Next
    CloseClipboard   ' make sure the clipboard is never left locked open
    GetClipboardFilePath = ""
End Function

' True for common image file extensions - guards against treating an
' arbitrary copied file (a document, a folder, etc.) as a photo.
Public Function IsImageFilePath(ByVal filePath As String) As Boolean
    Dim ext As String
    Dim dotPos As Long

    dotPos = InStrRev(filePath, ".")
    If dotPos = 0 Then Exit Function

    ext = LCase$(Mid$(filePath, dotPos + 1))
    Select Case ext
        Case "jpg", "jpeg", "png", "bmp", "gif", "tif", "tiff", "emf", "wmf"
            IsImageFilePath = True
    End Select
End Function
