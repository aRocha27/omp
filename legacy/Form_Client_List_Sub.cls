VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Form_Client_List_Sub"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = True
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Compare Database

Private Sub Check137_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub codpost_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Contacto_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub fax_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub ID_Cliente_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub local_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub morada_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub ncont_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub no_PHC_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub nome_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub telefone_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Tp_Cliente_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub zona_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Client", acNormal, , "[ID_Cliente]=" & Me![ID_Cliente], acFormReadOnly, acWindowNormal
End If

End Sub
