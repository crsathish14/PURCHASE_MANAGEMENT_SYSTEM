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
' lpszFile is a LongPtr (passed as StrPtr(buffer)), NOT "ByVal ... As String": VBA converts a
' ByVal String argument to ANSI for every Declare, but this is the wide (W) API and writes
' UTF-16 - through a String parameter the path comes back as "C" & vbNullChar & ":" & ...
' and never matches an image extension.
Private Declare PtrSafe Function DragQueryFileW Lib "shell32.dll" (ByVal hDrop As LongPtr, ByVal iFile As Long, ByVal lpszFile As LongPtr, ByVal cch As Long) As Long

Private Const CF_HDROP As Long = 15
Private Const DRAGQUERY_COUNT As Long = -1   ' 0xFFFFFFFF: ask DragQueryFileW for the number of files

' Returns the path of EVERY image file sitting on the clipboard as a file
' reference (several can be copied at once in File Explorer), in the order
' Explorer lists them. Non-image files (documents, folders) are skipped.
' Returns an empty collection if the clipboard holds no file reference at
' all, which just means "fall back to a normal clipboard image-data paste" -
' this never raises an error to the caller.
Public Function GetClipboardImageFilePaths() As Collection
    Dim result As New Collection
    Dim hDropPtr As LongPtr
    Dim fileCount As Long, i As Long, nameLen As Long
    Dim buf As String
    Dim opened As Boolean

    On Error GoTo Fail

    If IsClipboardFormatAvailable(CF_HDROP) <> 0 Then
        If OpenClipboard(0) <> 0 Then
            opened = True
            hDropPtr = GetClipboardData(CF_HDROP)
            If hDropPtr <> 0 Then
                fileCount = DragQueryFileW(hDropPtr, DRAGQUERY_COUNT, 0, 0)
                For i = 0 To fileCount - 1
                    nameLen = DragQueryFileW(hDropPtr, i, 0, 0)   ' length, without the terminator
                    If nameLen > 0 Then
                        buf = String$(nameLen + 1, vbNullChar)
                        If DragQueryFileW(hDropPtr, i, StrPtr(buf), nameLen + 1) > 0 Then
                            buf = Left$(buf, nameLen)
                            If IsImageFilePath(buf) Then result.Add buf
                        End If
                    End If
                Next i
            End If
            CloseClipboard
            opened = False
        End If
    End If

    Set GetClipboardImageFilePaths = result
    Exit Function

Fail:
    If opened Then CloseClipboard   ' make sure the clipboard is never left locked open
    Set GetClipboardImageFilePaths = New Collection
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
