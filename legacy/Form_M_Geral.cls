VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Form_M_Geral"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = True
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Compare Database

Private Sub B_Client_Click()

If Me.Editar = "S" Then
    DoCmd.OpenForm "Client_List", acNormal, , , acFormEdit
Else
    DoCmd.OpenForm "Client_List", acNormal, , , acFormReadOnly
End If

End Sub

Private Sub B_FNeg_Click()

DoCmd.SetWarnings False
    DoCmd.OpenQuery "FNeg_Order_Reconhecimento_TBL", acViewNormal, acEdit
    DoCmd.OpenQuery "FNeg_Order_Reconhecimento_UPD", acViewNormal, acEdit
    DoCmd.DeleteObject acTable, "FNeg_aux"
DoCmd.SetWarnings True

MsgBox "Rotina de fechar negócios terminada.", vbInformation, "Fechar Negócios"

End Sub

Private Sub B_Order_Click()

If Me.Editar = "S" Then
    DoCmd.OpenForm "Order_List", acNormal, , , acFormEdit
Else
    DoCmd.OpenForm "Order_List", acNormal, , , acFormReadOnly
End If

End Sub

Private Sub B_Stck_Alt_Click()

DoCmd.OpenForm "Stck_List", acNormal, , , acFormEdit

End Sub

Private Sub Command114_Click()

DoCmd.OpenForm "M_Mapas", acNormal, , , acFormEdit

End Sub

Private Sub Command122_Click()

If Me.Editar = "S" Then
    DoCmd.OpenForm "Client_Fact_List", acNormal, , , acFormEdit
Else
    DoCmd.OpenForm "Client_Fact_List", acNormal, , , acFormReadOnly
End If

End Sub

Private Sub Command123_Click()
'If Me.Editar = "S" Then
    DoCmd.OpenForm "Reconhecido_porTipo_Crosstab_DT", acNormal, , , acFormEdit, acWindowNormal
'Else
'    DoCmd.OpenForm "Reconhecido_porTipo_Crosstab_DT", acNormal, , , acFormReadOnly
'End If
End Sub

Private Sub Command84_Click()

If Me.Editar = "S" Then
    DoCmd.OpenForm "Enc_Factory_List", acNormal, , , acFormEdit
Else
    DoCmd.OpenForm "Enc_Factory_List", acNormal, , , acFormReadOnly
End If

End Sub

Private Sub Form_Activate()

    DoCmd.Restore

    Tabelas = 0

End Sub

Private Sub Form_Load()

'#
'# OBTER INFORMAÇÕES DO NOME E DOMINIO DO UTILIZADOR
'#

'### Definir Variaveis
Dim objNetwork, Username, UserDomain

'### Cria Objecto Network
Set objNetwork = CreateObject("WScript.Network")

Username = objNetwork.Username
UserDomain = objNetwork.UserDomain

'MsgBox Username & " - " & UserDomain

Form_M_Geral.ID_User = Username
'Form_M_Geral_Domain = UserDomain

Me.Refresh

' *** ESCONDER MENU ACCESS - RIBBON ***

'DoCmd.ShowToolbar "Ribbon", acToolbarNo 'Descomentar para PRODUÇÃO
DoCmd.ShowToolbar "Ribbon", acToolbarYes 'Descomentar para DESENVOLVIMENTO


' *** TESTAR UTILIZADOR ***
Dim TST_User As Variant
Dim TST_ro As Variant
Dim TST_Admin As Variant

TST_User = DLookup("[Cancelado]", "[Utilizador]", "(([ID_User]=Forms![M_Geral]![ID_User]))")

If (TST_User = 0) Then
    Forms![M_Geral]![User] = DLookup("[User_Name]", "[Utilizador]", "(([ID_User]=[Forms]![M_Geral]![ID_User]))")
    
    TST_ro = DLookup("[Read_Only]", "[Utilizador]", "(([ID_User]=Forms![M_Geral]![ID_User]))")
    If TST_ro = True Then
        Forms![M_Geral]![Editar] = "N"
    Else
        Forms![M_Geral]![Editar] = "S"
    End If
    
    TST_Admin = DLookup("[Admin]", "[Utilizador]", "(([ID_User]=Forms![M_Geral]![ID_User]))")
    If TST_Admin = True Then
        Forms![M_Geral]![Editar] = "S"
        Forms![M_Geral]![Admin] = "S"
        Me.Tabelas.Visible = True
        Me.DT_Fecho.Visible = True
        Me.B_FNeg.Visible = True
    Else
        Forms![M_Geral]![Admin] = "N"
        Me.Tabelas.Visible = False
        Me.DT_Fecho.Visible = False
        Me.B_FNeg.Visible = False
    End If

Else
    MsgBox "Utilizador não registado na aplicação !!!" & Chr(13) & Chr(13) & "Não terá perfil de edição.", vbInformation, "Validação do Utilizador"
    Forms![M_Geral]![Editar] = "N"
    Forms![M_Geral]![User] = Me.ID_User & " - Sem edição"
'    DoCmd.Quit
End If

End Sub

Private Sub Sair_Click()
On Error GoTo Err_Sair_Click

    DoCmd.Quit

Exit_Sair_Click:
    Exit Sub

Err_Sair_Click:
    MsgBox Err.description
    Resume Exit_Sair_Click
    
End Sub

Private Sub Tabelas_AfterUpdate()

Dim tbl As Integer
tbl = 0

If Tabelas = 1 Then
    Me.Tabelas = 1
    DoCmd.OpenForm "tbl_Area", acNormal, , , acFormEdit, acWindowNormal
    tbl = 1
End If

If Tabelas = 2 Then
    Me.Tabelas = 1
    DoCmd.OpenForm "tbl_Tipo", acNormal, , , acFormEdit, acWindowNormal
    tbl = 1
End If

If Tabelas = 3 Then
    Me.Tabelas = 1
    DoCmd.OpenForm "tbl_Produto", acNormal, , , acFormEdit, acWindowNormal
    tbl = 1
End If

If Tabelas = 4 Then
    Me.Tabelas = 1
    DoCmd.OpenForm "tbl_Instrumento", acNormal, , , acFormEdit, acWindowNormal
    tbl = 1
End If

If Tabelas = 5 Then
    Me.Tabelas = 1
    DoCmd.OpenForm "tbl_Tp_Cliente", acNormal, , , acFormEdit, acWindowNormal
    tbl = 1
End If

If Tabelas = 6 Then
    Me.Tabelas = 1
    DoCmd.OpenForm "tbl_Tp_Order", acNormal, , , acFormEdit, acWindowNormal
    tbl = 1
End If

If Tabelas = 7 Then
    Me.Tabelas = 1
    DoCmd.OpenForm "tbl_Tp_Revenue", acNormal, , , acFormEdit, acWindowNormal
    tbl = 1
End If

If Tabelas = 8 Then
    Me.Tabelas = 1
    DoCmd.OpenForm "tbl_Tp_Warranty", acNormal, , , acFormEdit, acWindowNormal
    tbl = 1
End If

If Tabelas = 9 Then
    Me.Tabelas = 1
    DoCmd.OpenForm "tbl_Tp_Reconhecimento", acNormal, , , acFormEdit, acWindowNormal
    tbl = 1
End If

If Tabelas = 10 Then
    Me.Tabelas = 1
    DoCmd.OpenForm "tbl_Tp_Doc_FT", acNormal, , , acFormEdit, acWindowNormal
    tbl = 1
End If

If Tabelas = 11 Then
    Me.Tabelas = 1
    DoCmd.OpenForm "tbl_Grp_Report", acNormal, , , acFormEdit, acWindowNormal
    tbl = 1
End If

If Tabelas = 12 Then
    Me.Tabelas = 1
    DoCmd.OpenForm "tbl_Fact_Status", acNormal, , , acFormEdit, acWindowNormal
    tbl = 1
End If

If Tabelas = 98 Then
    Me.Tabelas = 1
    DoCmd.OpenForm "tbl_Utilizador", acNormal, , , acFormEdit, acWindowNormal
    tbl = 1
End If

If Tabelas = 99 Then
    Me.Tabelas = 1
    DoCmd.OpenForm "tbl_Identificacao", acNormal, , , acFormEdit, acWindowNormal
    tbl = 1
End If

If tbl = 0 Then
    MsgBox "    Tem que escolher um item da lista...!!!          ", vbInformation, "Manutenção de Tabelas"
    Me.Tabelas = 1
End If

End Sub
