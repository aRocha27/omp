VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Form_E_Mail_Env_Sub"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = True
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Compare Database

Private Sub Check373_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Contacto_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub DT_Doc_FT_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Email_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Encomenda_Cli_PHC_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub ID_Order_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub N_Doc_FT_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Nome_PDF_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Text267_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Text269_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Total_Amount_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Tp_Doc_FT_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Valor_Doc_FT_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub VAT_Amount_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub
