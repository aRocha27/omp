VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Form_Client"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = True
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Compare Database

Private Sub Command37_Click()
On Error GoTo Err_Command37_Click


    DoCmd.Close

Exit_Command37_Click:
    Exit Sub

Err_Command37_Click:
    MsgBox Err.description
    Resume Exit_Command37_Click
    
End Sub

Private Sub Command43_Click()
On Error GoTo Err_Command43_Click


    DoCmd.DoMenuItem acFormBar, acEditMenu, 8, , acMenuVer70
    DoCmd.DoMenuItem acFormBar, acEditMenu, 6, , acMenuVer70

Exit_Command43_Click:
    Exit Sub

Err_Command43_Click:
    MsgBox Err.description
    Resume Exit_Command43_Click
    
End Sub
Private Sub Command44_Click()
On Error GoTo Err_Command44_Click


    DoCmd.GoToRecord , , acNewRec

Exit_Command44_Click:
    Exit Sub

Err_Command44_Click:
    MsgBox Err.description
    Resume Exit_Command44_Click
    
End Sub
