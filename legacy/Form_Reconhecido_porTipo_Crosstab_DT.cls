VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Form_Reconhecido_porTipo_Crosstab_DT"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = True
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Compare Database

Private Sub Command4_Click()

'If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Reconhecido_porTipo_Crosstab", acNormal, , , acFormEdit
'Else
'    DoCmd.OpenForm "Reconhecido_porTipo_Crosstab", acNormal, , , acFormReadOnly
'End If

End Sub

Private Sub Command5_Click()

DoCmd.Close acForm, "Reconhecido_porTipo_Crosstab_DT"

End Sub

Private Sub Form_Current()

Me.Data_Inicial = "01/01/" & Year(Date)
Me.Data_Final = "31/12/" & Year(Date)

End Sub
