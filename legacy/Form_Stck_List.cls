VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Form_Stck_List"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = True
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Compare Database

Private Sub B_Cons_Mov_Click()

If Forms![M_Geral]![Admin] = "S" Then
    DoCmd.OpenForm "Stck_Mov_Mat_tbl_edt", acNormal, , , acFormEdit
Else
    DoCmd.OpenForm "Stck_Mov_Mat_tbl_edt", acNormal, , , acFormReadOnly
'    DoCmd.OpenForm "Stck_Mov_Mat_tbl_edt", acNormal, , , acFormEdit
End If

End Sub

Private Sub B_Inserir_Mov_Click()

DoCmd.OpenForm "Stck_Mov_Mat_tbl_add", acNormal, , , acFormAdd

End Sub

Private Sub B_LimparF_Click()

Me.F_arm = Null
Me.F_desc = Null
Me.F_ref = Null
Me.Stck_List_Sub.SourceObject = ""

End Sub

Private Sub B_Tbl_Armazens_Click()

DoCmd.OpenForm "stck_Armazens_tbl", acNormal, , , acFormEdit

End Sub

Private Sub B_Tbl_Materiais_Click()

DoCmd.OpenForm "stck_Materiais_tbl", acNormal, , , acFormEdit

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

Private Sub B_AtualizarF_Click()

Dim qry As String
Dim whr As String

qry = "select * from dbo_V_stck_Group"

If Not IsNull(Me.F_ref) Then
    If whr = "" Then
        whr = "[ref] like '*" & Me.F_ref & "*'"
    Else
        whr = whr & " and [ref] like '*" & Me.F_ref & "*'"
    End If
End If

If Not IsNull(Me.F_desc) Then
    If whr = "" Then
        whr = "[description] like '*" & Me.F_desc & "*'"
    Else
        whr = whr & " and [description] like '*" & Me.F_desc & "*'"
    End If
End If

If Not IsNull(Me.F_arm) Then
    If whr = "" Then
        whr = "[id_arm] = " & Me.F_arm
    Else
        whr = whr & " and [id_arm] = " & Me.F_arm
    End If
End If

Me.Stck_List_Sub.SourceObject = "Stck_List_Sub"

If whr = "" Then
    Me.Stck_List_Sub.Form.RecordSource = qry
Else
    Me.Stck_List_Sub.Form.RecordSource = qry & " where " & whr
End If

End Sub
Private Sub Command46_Click()
On Error GoTo Err_Command46_Click

    Dim stDocName As String
    Dim stLinkCriteria As String

    stDocName = "Clientes"
    DoCmd.OpenForm stDocName, , , stLinkCriteria, acFormAdd

Exit_Command46_Click:
    Exit Sub

Err_Command46_Click:
    MsgBox Err.description
    Resume Exit_Command46_Click
    
End Sub

