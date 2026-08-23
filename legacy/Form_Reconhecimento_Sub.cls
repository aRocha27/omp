VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Form_Reconhecimento_Sub"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = True
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Compare Database

Private Sub DT_Reconhecimento_AfterUpdate()

Dim v_SIR As Variant
Dim v_SWR As Variant
Dim v_SIB As Variant
Dim v_SWB As Variant

Me.Refresh

v_SIR = Nz(DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]<>'W')"), 0)
v_SWR = Nz(DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]='W')"), 0)

v_SIB = (Nz(Form_Order.Sell_Price, 0) - Nz(Form_Order.Warranty_Reserve, 0)) - Nz(DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]<>'W' and [DT_Reconhecimento] <= Date())"), 0)
v_SWB = Nz(Form_Order.Warranty_Reserve, 0) - Nz(DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]='W' and [DT_Reconhecimento] <= Date())"), 0)

Form_Order.S_I_Reconh = v_SIR
Form_Order.S_W_Reconh = v_SWR

Form_Order.S_I_BackLog = v_SIB
Form_Order.S_W_BackLog = v_SWB

If v_SIR > (Nz(Form_Order.Sell_Price, 0) - Nz(Form_Order.Warranty_Reserve, 0)) Then
    MsgBox "O valor reconhecido de 'instrumento' é maior que o 'sell price' menos a 'warranty reserve'!!!", vbCritical, "Reconhecer valores"
End If

If v_SWR > Nz(Form_Order.Warranty_Reserve, 0) Then
    MsgBox "O valor reconhecido de 'warranty' é maior que a 'warranty reserve'!!!", vbCritical, "Reconhecer valores"
End If

End Sub

Private Sub DT_Reconhecimento_DblClick(Cancel As Integer)

If Me.DT_Reconhecimento < Date Then
    MsgBox "Vai editar um reconhecimento de data anterior a hoje!!", vbCritical, "Editar Reconhecimento"
End If

Me.DT_Reconhecimento.Locked = False

End Sub

Private Sub DT_Reconhecimento_GotFocus()

If Me.DT_Reconhecimento < Date Then
    Me.ID_Tp_Reconhecimento.Locked = True
    Me.DT_Reconhecimento.Locked = True
    Me.Valor_Reconhecimento.Locked = True
Else
    Me.ID_Tp_Reconhecimento.Locked = False
    Me.DT_Reconhecimento.Locked = False
    Me.Valor_Reconhecimento.Locked = False
End If

End Sub

Private Sub Form_AfterDelConfirm(Status As Integer)

Dim v_SIR As Variant
Dim v_SWR As Variant
Dim v_SIB As Variant
Dim v_SWB As Variant

Me.Refresh

v_SIR = DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]<>'W')")
v_SWR = DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]='W')")

v_SIB = DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]<>'W' and [DT_Reconhecimento] > Date())")
v_SWB = DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]='W' and [DT_Reconhecimento] > Date())")

If IsNull(v_SIR) Then
    v_SIR = 0
End If

If IsNull(v_SWR) Then
    v_SWR = 0
End If

If IsNull(v_SIB) Then
    v_SIB = 0
End If

If IsNull(v_SWB) Then
    v_SWB = 0
End If

Form_Order.S_I_Reconh = v_SIR
Form_Order.S_W_Reconh = v_SWR

Form_Order.S_I_BackLog = v_SIB
Form_Order.S_W_BackLog = v_SWB

If v_SIR > (Form_Order.Sell_Price - Form_Order.Warranty_Reserve) Then
    MsgBox "O valor reconhecido de 'instrumento' é maior que o 'sell price' menos a 'warranty reserve'!!!", vbCritical, "Reconhecer valores"
End If

If v_SWR > Form_Order.Warranty_Reserve Then
    MsgBox "O valor reconhecido de 'warranty' é maior que a 'warranty reserve'!!!", vbCritical, "Reconhecer valores"
End If

End Sub

Private Sub ID_Tp_Reconhecimento_AfterUpdate()

Dim v_SIR As Variant
Dim v_SWR As Variant
Dim v_SIB As Variant
Dim v_SWB As Variant

Me.Refresh

v_SIR = Nz(DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]<>'W')"), 0)
v_SWR = Nz(DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]='W')"), 0)

v_SIB = (Nz(Form_Order.Sell_Price, 0) - Nz(Form_Order.Warranty_Reserve, 0)) - Nz(DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]<>'W' and [DT_Reconhecimento] <= Date())"), 0)
v_SWB = Nz(Form_Order.Warranty_Reserve, 0) - Nz(DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]='W' and [DT_Reconhecimento] <= Date())"), 0)

Form_Order.S_I_Reconh = v_SIR
Form_Order.S_W_Reconh = v_SWR

Form_Order.S_I_BackLog = v_SIB
Form_Order.S_W_BackLog = v_SWB

If v_SIR > (Nz(Form_Order.Sell_Price, 0) - Nz(Form_Order.Warranty_Reserve, 0)) Then
    MsgBox "O valor reconhecido de 'instrumento' é maior que o 'sell price' menos a 'warranty reserve'!!!", vbCritical, "Reconhecer valores"
End If

If v_SWR > Nz(Form_Order.Warranty_Reserve, 0) Then
    MsgBox "O valor reconhecido de 'warranty' é maior que a 'warranty reserve'!!!", vbCritical, "Reconhecer valores"
End If

End Sub

Private Sub ID_Tp_Reconhecimento_DblClick(Cancel As Integer)

If Me.DT_Reconhecimento < Date Then
    MsgBox "Vai editar um reconhecimento de data anterior a hoje!!", vbCritical, "Editar Reconhecimento"
End If

Me.ID_Tp_Reconhecimento.Locked = False

End Sub

Private Sub ID_Tp_Reconhecimento_GotFocus()

If Me.DT_Reconhecimento < Date Then
    Me.ID_Tp_Reconhecimento.Locked = True
    Me.DT_Reconhecimento.Locked = True
    Me.Valor_Reconhecimento.Locked = True
Else
    Me.ID_Tp_Reconhecimento.Locked = False
    Me.DT_Reconhecimento.Locked = False
    Me.Valor_Reconhecimento.Locked = False
End If

End Sub

Private Sub Valor_Reconhecimento_AfterUpdate()

Dim v_SIR As Variant
Dim v_SWR As Variant
Dim v_SIB As Variant
Dim v_SWB As Variant
Dim v_Dif_I As Currency
Dim v_Dif_W As Currency

Me.Refresh

v_SIR = Nz(DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]<>'W')"), 0)
v_SWR = Nz(DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]='W')"), 0)

v_SIB = (Nz(Form_Order.Sell_Price, 0) - Nz(Form_Order.Warranty_Reserve, 0)) - Nz(DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]<>'W' and [DT_Reconhecimento] <= Date())"), 0)
v_SWB = Nz(Form_Order.Warranty_Reserve, 0) - Nz(DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]='W' and [DT_Reconhecimento] <= Date())"), 0)

Form_Order.S_I_Reconh = v_SIR
Form_Order.S_W_Reconh = v_SWR

Form_Order.S_I_BackLog = v_SIB
Form_Order.S_W_BackLog = v_SWB

If v_SIR > (Nz(Form_Order.Sell_Price, 0) - Nz(Form_Order.Warranty_Reserve, 0)) Then
    v_Dif_I = (Nz(Form_Order.Sell_Price, 0) - Nz(Form_Order.Warranty_Reserve, 0)) - v_SIR + Me.Valor_Reconhecimento
    MsgBox "O valor reconhecido de 'instrumento' é maior que o 'sell price' menos a 'warranty reserve'!!!" & vbCrLf & vbNewLine & "Falta reconhecer o valor de " & Format(v_Dif_I, "currency") & " (" & v_Dif_I & ")", vbCritical, "Reconhecer valores"
    Me.Valor_Reconhecimento = Null
    Me.DT_Reconhecimento.SetFocus
    Me.Refresh
    v_SIR = Nz(DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]<>'W')"), 0)
    Form_Order.S_I_Reconh = v_SIR
End If

If v_SWR > Nz(Form_Order.Warranty_Reserve, 0) Then
    v_Dif_W = Nz(Form_Order.Warranty_Reserve, 0) - v_SWR + Me.Valor_Reconhecimento
    MsgBox "O valor reconhecido de 'warranty' é maior que a 'warranty reserve'!!!" & vbCrLf & vbNewLine & "Falta reconhecer o valor de " & Format(v_Dif_W, "currency") & " (" & v_Dif_W & ")", vbCritical, "Reconhecer valores"
    Me.Valor_Reconhecimento = Null
    Me.DT_Reconhecimento.SetFocus
    Me.Refresh
    v_SWR = Nz(DSum("Valor_Reconhecimento", "Reconhecimento", "([ID_Order]= " & Me.ID_Order & " and [ID_Tp_Reconhecimento]='W')"), 0)
    Form_Order.S_W_Reconh = v_SWR
End If

End Sub

Private Sub Valor_Reconhecimento_DblClick(Cancel As Integer)

If Me.DT_Reconhecimento < Date Then
    MsgBox "Vai editar um reconhecimento de data anterior a hoje!!", vbCritical, "Editar Reconhecimento"
End If

Me.Valor_Reconhecimento.Locked = False

End Sub

Private Sub Valor_Reconhecimento_GotFocus()

If Me.DT_Reconhecimento < Date Then
    Me.ID_Tp_Reconhecimento.Locked = True
    Me.DT_Reconhecimento.Locked = True
    Me.Valor_Reconhecimento.Locked = True
Else
    Me.ID_Tp_Reconhecimento.Locked = False
    Me.DT_Reconhecimento.Locked = False
    Me.Valor_Reconhecimento.Locked = False
End If

End Sub

