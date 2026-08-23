VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Form_Client_List"
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

qry = "select * from Client_List"

If Not IsNull(Me.F_ID) Then
    If whr = "" Then
        whr = "[ID_Cliente] = " & Me.F_ID
    Else
        whr = whr & " and [ID_Cliente] = " & Me.F_ID
    End If
End If

If Not IsNull(Me.F_N_PHC) Then
    If whr = "" Then
        whr = "[no_PHC] = " & Me.F_N_PHC
    Else
        whr = whr & " and [no_PHC] = " & Me.F_N_PHC
    End If
End If

If Not IsNull(Me.F_Cliente) Then
    If whr = "" Then
        whr = "[Nome] like '*" & Me.F_Cliente & "*'"
    Else
        whr = whr & " and [Nome] like '*" & Me.F_Cliente & "*'"
    End If
End If

If Not IsNull(Me.F_Contacto) Then
    If whr = "" Then
        whr = "[contacto] like '*" & Me.F_Contacto & "*'"
    Else
        whr = whr & " and [contacto] like '*" & Me.F_Contacto & "*'"
    End If
End If

If Not IsNull(Me.F_Tp_Cliente) Then
    If whr = "" Then
        whr = "[ID_Tp_Cliente] = " & Me.F_Tp_Cliente
    Else
        whr = whr & " and [ID_Tp_Cliente] = " & Me.F_Tp_Cliente
    End If
End If

If Not IsNull(Me.F_Defense) And Me.F_Defense < 2 Then
    If whr = "" Then
        If F_Defense = 0 Then
            whr = "[Defense] = false"
        Else
            whr = "[Defense] = true"
        End If
    Else
        If F_Defense = 0 Then
            whr = whr & " and [Defense] = false"
        Else
            whr = whr & " and [Defense] = true"
        End If
    End If
End If

Me.Client_List.SourceObject = "Client_List_Sub"

If whr = "" Then
    Me.Client_List.Form.RecordSource = qry
Else
    Me.Client_List.Form.RecordSource = qry & " where " & whr
End If

End Sub
Private Sub B_Insert_Click()
On Error GoTo Err_B_Insert_Click

    Dim stDocName As String
    Dim stLinkCriteria As String

    stDocName = "Client"
    DoCmd.OpenForm stDocName, , , stLinkCriteria, acFormAdd

Exit_B_Insert_Click:
    Exit Sub

Err_B_Insert_Click:
    MsgBox Err.description
    Resume Exit_B_Insert_Click
    
End Sub

Private Sub B_Limpar_Click()

Me.F_ID = Null
Me.F_N_PHC = Null
Me.F_Cliente = Null
Me.F_Contacto = Null
Me.F_Tp_Cliente = Null
Me.F_Defense = 9

Me.Client_List.SourceObject = "Client_List_Sub"

Me.Client_List.Form.RecordSource = "select Client.ID_Cliente from Client_List where ID_Cliente is null"

Me.Refresh

End Sub

Private Sub Form_Current()

If Form_M_Geral.Editar = "S" Then
    Me.B_Insert.Enabled = True
Else
    Me.B_Insert.Enabled = False
End If

End Sub
