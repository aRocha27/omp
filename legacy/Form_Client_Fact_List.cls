VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Form_Client_Fact_List"
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

Private Sub B_Actualizar_Click()

Dim qry As String
Dim whr As String

whr = ""

qry = "select * from V_Facturacao_List"

If Not IsNull(Me.F_Enc_PHC) Then
    If whr = "" Then
        whr = "[Encomenda_Cli_PHC] like '*" & Me.F_Enc_PHC & "*'"
    Else
        whr = whr & " and [Encomenda_Cli_PHC] like '*" & Me.F_Enc_PHC & "*'"
    End If
End If

If Not IsNull(Me.F_Enc_Factory) Then
    If whr = "" Then
        whr = "[Cod_Enc_Factory] like '*" & Me.F_Enc_Factory & "*'"
    Else
        whr = whr & " and [Cod_Enc_Factory] like '*" & Me.F_Enc_Factory & "*'"
    End If
End If

If Not IsNull(Me.F_Order_Confirmation) Then
    If whr = "" Then
        whr = "[Order_Confirmation] like '*" & Me.F_Order_Confirmation & "*'"
    Else
        whr = whr & " and [Order_Confirmation] like '*" & Me.F_Order_Confirmation & "*'"
    End If
End If

If Not IsNull(Me.F_Invoice) Then
    If whr = "" Then
        whr = "[Invoice] like '*" & Me.F_Invoice & "*'"
    Else
        whr = whr & " and [Invoice] like '*" & Me.F_Invoice & "*'"
    End If
End If

If Not IsNull(Me.F_Ship_DT_i) Then
    If whr = "" Then
        whr = "[Ship_DT] >= #" & Format(Me.F_Ship_DT_i, "mm\/dd\/yyyy") & "#"
    Else
        whr = whr & " and [Ship_DT] >= #" & Format(Me.F_Ship_DT_i, "mm\/dd\/yyyy") & "#"
    End If
End If

If Not IsNull(Me.F_Ship_DT_f) Then
    If whr = "" Then
        whr = "[Ship_DT] <= #" & Format(Me.F_Ship_DT_f, "mm\/dd\/yyyy") & "#"
    Else
        whr = whr & " and [Ship_DT] <= #" & Format(Me.F_Ship_DT_f, "mm\/dd\/yyyy") & "#"
    End If
End If

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

If Not IsNull(Me.F_Area) Then
    If whr = "" Then
        whr = "[ID_Area] like '*" & Me.F_Area & "*'"
    Else
        whr = whr & " and [ID_Area] like '*" & Me.F_Area & "*'"
    End If
End If

If Not IsNull(Me.F_Tipo) Then
    If whr = "" Then
        whr = "[ID_Tipo] like '*" & Me.F_Tipo & "*'"
    Else
        whr = whr & " and [ID_Tipo] like '*" & Me.F_Tipo & "*'"
    End If
End If

If Not IsNull(Me.F_Produto) Then
    If whr = "" Then
        whr = "[ID_Produto] = " & Me.F_Produto
    Else
        whr = whr & " and [ID_Produto] = " & Me.F_Produto
    End If
End If

If Not IsNull(Me.F_Cliente) Then
    If whr = "" Then
        whr = "[Nome] like '*" & Me.F_Cliente & "*'"
    Else
        whr = whr & " and [Nome] like '*" & Me.F_Cliente & "*'"
    End If
End If

If Not IsNull(Me.F_N_Doc_FT) Then
    If whr = "" Then
        whr = "[N_Doc_FT] like '*" & Me.F_N_Doc_FT & "*'"
    Else
        whr = whr & " and [N_Doc_FT] like '*" & Me.F_N_Doc_FT & "*'"
    End If
End If
 

'MsgBox whr

'Me.Enc_Factory_List.SourceObject = "Enc_Factory_List_Sub"

If whr = "" Then
    'Me.Enc_Factory_List____.Form.RecordSource = qry
    Me.RecordSource = qry
Else
    'Me.Enc_Factory_List____.Form.RecordSource = qry & " where " & whr
    Me.RecordSource = qry & " where " & whr
End If

End Sub

Private Sub B_Limpar_Click()

Me.F_Enc_PHC = Null
Me.F_Enc_Factory = Null
Me.F_Order_Confirmation = Null
Me.F_Invoice = Null
Me.F_Ship_DT_i = Null
Me.F_Ship_DT_f = Null
Me.F_DT_Order_i = Null
Me.F_DT_Order_f = Null
Me.F_Area = Null
Me.F_Tipo = Null
Me.F_Produto = Null
Me.F_Cliente = Null
Me.F_N_Doc_FT = Null

'Me.Enc_Factory_List.SourceObject = "Enc_Factory_List_Sub"

Me.RecordSource = "V_Enc_Factory_List"

Me.Refresh

End Sub

Private Sub Form_Current()

'If Form_M_Geral.Editar = "S" Then
'    Me.B_Insert.Enabled = True
'Else
'    Me.B_Insert.Enabled = False
'End If

End Sub
