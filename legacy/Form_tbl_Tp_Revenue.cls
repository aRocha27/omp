VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Form_tbl_Tp_Revenue"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = True
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Compare Database

Private Sub Command16_Click()
On Error GoTo Err_Command16_Click


    DoCmd.Close

Exit_Command16_Click:
    Exit Sub

Err_Command16_Click:
    MsgBox Err.description
    Resume Exit_Command16_Click
    
End Sub
Private Sub Command19_Click()
On Error GoTo Err_Command19_Click


    DoCmd.DoMenuItem acFormBar, acEditMenu, 8, , acMenuVer70
    DoCmd.DoMenuItem acFormBar, acEditMenu, 6, , acMenuVer70

Exit_Command19_Click:
    Exit Sub

Err_Command19_Click:
    MsgBox Err.description
    Resume Exit_Command19_Click
    
End Sub
