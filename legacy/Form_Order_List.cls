VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Form_Order_List"
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

Private Sub Command45_Click()

Dim qry As String
Dim whr As String

qry = "select * from V_Order_List"

If Not IsNull(Me.F_DT_Order_i) Then
    If whr = "" Then
        whr = "[DT_Order] >= #" & Format(Me.F_DT_Order_i, "mm\/dd\/yyyy") & "#"
    Else
        whr = whr & " and [DT_Order] >= #" & Format(Me.F_DT_Order_i, "mm\/dd\/yyyy") & "#"
    End If
End If

If Not IsNull(Me.F_DT_Order_f) Then
    If whr = "" Then
        whr = "[DT_Order] <= #" & Format(Me.F_DT_Order_f, "mm\/dd\/yyyy") & "#"
    Else
        whr = whr & " and [DT_Order] <= #" & Format(Me.F_DT_Order_f, "mm\/dd\/yyyy") & "#"
    End If
End If

If Not IsNull(Me.F_Cliente) Then
    If whr = "" Then
        whr = "[Nome] like '*" & Me.F_Cliente & "*'"
    Else
        whr = whr & " and [Nome] like '*" & Me.F_Cliente & "*'"
    End If
End If

If Not IsNull(Me.F_Factory) And Me.F_Factory < 2 Then
    If whr = "" Then
        If F_Factory = 0 Then
            whr = "[Order_Factory] = false"
        Else
            whr = "[Order_Factory] = true"
        End If
    Else
        If F_Factory = 0 Then
            whr = whr & " and [Order_Factory] = false"
        Else
            whr = whr & " and [Order_Factory] = true"
        End If
    End If
End If

If Not IsNull(Me.F_Tp_Order) Then
    If whr = "" Then
        whr = "[ID_Tp_Order] = '" & Me.F_Tp_Order & "'"
    Else
        whr = whr & " and [ID_Tp_Order] = '" & Me.F_Tp_Order & "'"
    End If
End If

If Not IsNull(Me.F_Area) Then
    If whr = "" Then
        whr = "[ID_Area] = '" & Me.F_Area & "'"
    Else
        whr = whr & " and [ID_Area] = '" & Me.F_Area & "'"
    End If
End If

If Not IsNull(Me.F_Tipo) Then
    If whr = "" Then
        whr = "[ID_Tipo] = '" & Me.F_Tipo & "'"
    Else
        whr = whr & " and [ID_Tipo] = '" & Me.F_Tipo & "'"
    End If
End If

If Not IsNull(Me.F_Produto) Then
    If whr = "" Then
        whr = "[ID_Produto] = " & Me.F_Produto
    Else
        whr = whr & " and [ID_Produto] = " & Me.F_Produto
    End If
End If

If Not IsNull(Me.F_Instrumento) Then
    If whr = "" Then
        whr = "[ID_Instrumento] = " & Me.F_Instrumento
    Else
        whr = whr & " and [ID_Instrumento] = " & Me.F_Instrumento
    End If
End If

If Not IsNull(Me.F_Enc_PHC) Then
    If whr = "" Then
        whr = "[Encomenda_Cli_PHC] like '*" & Me.F_Enc_PHC & "*'"
    Else
        whr = whr & " and [Encomenda_Cli_PHC] like '*" & Me.F_Enc_PHC & "*'"
    End If
End If

If Not IsNull(Me.F_Neg_Fechado) And Me.F_Neg_Fechado < 2 Then
    If whr = "" Then
        If F_Neg_Fechado = 0 Then
            whr = "[Negocio_Fechado] = false"
        Else
            whr = "[Negocio_Fechado] = true"
        End If
    Else
        If F_Neg_Fechado = 0 Then
            whr = whr & " and [Negocio_Fechado] = false"
        Else
            whr = whr & " and [Negocio_Fechado] = true"
        End If
    End If
End If

'If Not IsNull(Me.F_Orc_Prop) Then
'    If whr = "" Then
'        whr = "[Orc_Proposta] like '*" & Me.F_Orc_Prop & "*'"
'    Else
'        whr = whr & " and [Orc_Proposta] like '*" & Me.F_Orc_Prop & "*'"
'    End If
'End If

Me.Order_List.SourceObject = "Order_List_Sub"

If whr = "" Then
    Me.Order_List.Form.RecordSource = qry & " order by [DT_Order] desc, [ID_order] desc"
Else
    Me.Order_List.Form.RecordSource = qry & " where " & whr & " order by [DT_Order] desc, [ID_order] desc"
End If

End Sub
Private Sub B_Insert_Click()
On Error GoTo Err_B_Insert_Click

    Dim stDocName As String
    Dim stLinkCriteria As String

    stDocName = "Order"
    DoCmd.OpenForm stDocName, , , stLinkCriteria, acFormAdd

Exit_B_Insert_Click:
    Exit Sub

Err_B_Insert_Click:
    MsgBox Err.description
    Resume Exit_B_Insert_Click
    
End Sub

Private Sub Command48_Click()

Me.F_DT_Order_i = Null
Me.F_DT_Order_f = Null
Me.F_Cliente = Null
Me.F_Factory = 9
Me.F_Tp_Order = Null
Me.F_Area = Null
Me.F_Tipo = Null
Me.F_Produto = Null
Me.F_Instrumento = Null
Me.F_Enc_PHC = Null
Me.F_Neg_Fechado = 9
'Me.F_Orc_Prop = Null

'Me.Order_List.SourceObject = "Order_List_Sub"
Me.Order_List.SourceObject = ""

'Me.Order_List.Form.RecordSource = "select Order.ID_Order from Order_List where ID_Order is null"

Me.Refresh

End Sub

Private Sub Command71_Click()

DoCmd.OpenForm "E_Mail_Env", acNormal, , , acFormEdit, acWindowNormal

End Sub

Private Sub Form_Current()

If Form_M_Geral.Editar = "S" Then
    Me.B_Insert.Enabled = True
Else
    Me.B_Insert.Enabled = False
End If

End Sub
