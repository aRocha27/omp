VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Form_Reconhecido_porTipo_Crosstab"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = True
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Compare Database

Private Sub Combo266_Change()
DoCmd.ApplyFilter , "ID_Order = 1"
End Sub

Private Sub comboFact_AfterUpdate()

Dim v_n As Variant

v_n = DCount("[ID_Order]", "Reconhecido_porTipo_Crosstab", "[ID_Order]=" & Me.comboFact)
'MsgBox v_n

If v_n = 0 Then
    MsgBox "Documento não encontrado na listagem actual...", vbExclamation, "Pesquisa de Fatura"
Else
    Me.ID_Order.SetFocus
    DoCmd.FindRecord Me.comboFact, acEntire, False, acSearchAll, , acCurrent
End If

End Sub

Private Sub Command37_Click()
On Error GoTo Err_Command37_Click

    DoCmd.Close

Exit_Command37_Click:
    Exit Sub

Err_Command37_Click:
    MsgBox Err.description
    Resume Exit_Command37_Click
End Sub

Private Sub Form_Close()

DoCmd.Close acForm, "Reconhecido_porTipo_Crosstab_DT"

End Sub

Private Sub Form_Load()

DoCmd.Close acForm, "Reconhecido_porTipo_Crosstab_DT"

End Sub
