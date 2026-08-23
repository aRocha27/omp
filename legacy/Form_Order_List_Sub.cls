VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Form_Order_List_Sub"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = True
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Compare Database

Private Sub Area_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Cod_Enc_Fornecedor_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Check217_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub DT_Order_DblClick(Cancel As Integer)

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

Private Sub Instrumento_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub nome_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Orc_Proposta_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Order_Factory_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub PO_Cliente_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Produto_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Sell_Price_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Tipo_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Tp_Order_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Tp_Warranty_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Warranty_DT_Inicio_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub

Private Sub Warranty_Reserve_DblClick(Cancel As Integer)

If Form_M_Geral.Editar = "S" Then
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormEdit, acWindowNormal
Else
    DoCmd.OpenForm "Order", acNormal, , "[ID_Order]=" & Me![ID_Order], acFormReadOnly, acWindowNormal
End If

End Sub
