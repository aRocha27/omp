VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Form_E_Mail_Env"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = True
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Compare Database

Private Sub B_Env_Email_Click()

'*** ENVIA E-MAIL ***

On Error GoTo err_Error_handler

'*** Enviar e-mail: Código consultado em https://social.msdn.microsoft.com/Forums/office/en-US/051c86c6-23d2-46be-9737-35380903b25d/send-an-access-report-as-a-pdf-attachment-and-use-a-template-for-the-outlook-email?forum=accessdev

' Variáveis para BD
Dim db As DAO.Database
Dim rs As DAO.Recordset
Dim v_SQL As String

Set db = CurrentDb
If Me.whr_aux = "" Then
    v_SQL = "SELECT * FROM E_Mail_Env_List"
Else
    v_SQL = "SELECT * FROM E_Mail_Env_List WHERE " & Me.whr_aux
End If
Set rs = db.OpenRecordset(v_SQL, dbOpenDynaset, dbSeeChanges)

MsgBox "tst"

If rs.EOF Then
    MsgBox "Não existem faturas para enviar!!", vbExclamation, "Envio de e-mail"
Else
    rs.MoveFirst

    ' Variáveis para criar, anexar ficheiro PDF e comuns
    Dim v_Cliente As String
    Dim v_Tp_Doc As String
    Dim v_N_Doc As String
    Dim v_PO As String
    Dim v_DT_Doc As Date
    Dim v_Valor_sIVA As String
    Dim v_Valor_IVA As String
    Dim v_Valor_Total As String
    Dim v_Path As String

    ' Variáveis para enviar e-mail
    Dim v_From As String
    Dim v_To As String
    Dim v_Cc As String
    Dim v_Subject As String
    Dim v_MessageText As String
    Dim v_TempleteFile As String
    Dim v_CountEmail As Integer
    Dim v_CountEmail_err As Integer
    Dim v_Log As String
    Dim v_Log_email As String
    Dim v_Log_s_anexo As String
    Dim v_Log_endereco As String

    'Constantes
    v_Cliente = Me.Nome
    v_Tp_Doc = Me.Tp_Doc_FT
    v_N_Doc = Me.N_Doc_FT
    v_PO = Me.PO_Cliente
    v_DT_Doc = Format(Me.DT_Doc_FT, "dd\/mm\/yyyy")
    v_Valor_sIVA = Format(Me.Valor_Doc_FT, "#,##0.00€")
    v_Valor_IVA = Format(Me.VAT_Amount, "#,##0.00€")
    v_Valor_Total = Format(Me.Total_Amount, "#,##0.00€")
    v_Path_File = Me.Path & "\" & Me.Nome_PDF
    
    v_CountEmail = 0
    v_CountEmail_err = 0
    v_Log = ""
    v_Log_email = ""
    v_Log_s_anexo = ""
    v_Log_endereco = ""
    
    Do While Not rs.EOF

        '*** Enviar E-MAIL
        ' Variáveis para criar e-mail
        Dim objOutlook As Object
        Dim objMailItem As Object
        Const olMailItem As Integer = 0
        Set objOutlook = CreateObject("Outlook.Application")
        Set objMailItem = objOutlook.CreateItem(olMailItem)
        'Set objMailItem = objOutlook.CreateItem(MailItem)

        v_From = "brukerportugal@bruker.com"
        v_To = rs!Email
        'v_Cc = ""
        v_Subject = "BRUKER - " & v_Tp_Doc & " N. " & v_N_Doc & " da V/ encomenda N. " & v_PO
        v_MessageText = v_Cliente & vbCrLf & vbCrLf & "Caro Cliente," & vbCrLf & _
            vbCrLf & vbCrLf & _
            "Vimos por este meio enviar a N/ " & v_Tp_Doc & " nº " & v_N_Doc & " da V/ nota de encomenda " & v_PO & " no valor total de " & v_Valor_Total & "." & vbCrLf & vbCrLf & _
            "Detalhes do Documento: " & vbCrLf & vbCrLf & _
            "Data do Documento: " & v_DT_Doc & vbCrLf & _
            "Tipo de Documento: " & v_Tp_Doc & vbCrLf & _
            "Valor sem IVA: " & v_Valor_sIVA & vbCrLf & _
            "Valor do IVA: " & v_Valor_IVA & vbCrLf & _
            "Total: " & v_Valor_Total & vbCrLf & vbCrLf & vbCrLf & _
            "Com os meus melhores cumprimentos," & vbCrLf & vbCrLf & _
            "Susana Campos" & vbCrLf & _
            "Assistente Comercial / Sales Assistant" & vbCrLf & vbCrLf & _
            "Bruker Portugal Unipessoal, Lda" & vbCrLf & _
            "p: +351 218 257 150" & vbCrLf & _
            "w: www.Bruker.Com" & vbCrLf & _
            "e: susana.campos@Bruker.Com" & vbCrLf & _
            "a: Rua da Quinta da Quintã, 5" & vbCrLf & _
            "   Quinta da Fonte, Edifício Plaza II - RC - Fracção B" & vbCrLf & _
            "   2770-203, Paço de Arcos" & vbCrLf & _
            "GPS: N 38º 42’ 44.4, W 9º 17’ 53.6" & vbCrLf & vbCrLf & _
            "(Esta mensagem foi gerada de forma automática)"

        'set sender
        objMailItem.SentOnBehalfOfName = v_From
        'set receipient
        objMailItem.To = v_To
        'set read receipt request
        objMailItem.readreceiptrequested = True
        'set subject
        objMailItem.Subject = v_Subject
        'set body content
        objMailItem.Body = v_MessageText

        'Check path and file, then set Attachment
        If Len(Dir(v_Path_File)) Then
            With objMailItem.Attachments
                'use parenthisis around the path
                .Add (v_Path_File)
            End With
        Else
            If v_Log_s_anexo = "" Then
                v_Log_s_anexo = "Os e-mail's para os seguintes clientes seguiram sem anexo:" & vbCrLf & _
                                "- " & v_Cliente & " - " & v_Tp_Doc & " N. " & v_N_Doc
            Else
                v_Log_s_anexo = v_Log_s_anexo & vbCrLf & "- " & v_Cliente & " - " & v_Tp_Doc & " N. " & v_N_Doc
            End If
        End If
        
        'sending email
        objMailItem.Send
        
        
        If v_Log_email = "" Then
            v_Log_email = "A rotina enviou e-mail para os seguintes Clientes:" & vbCrLf & _
                            "- " & v_Cliente & " - " & v_Tp_Doc & " N. " & v_N_Doc
        Else
            v_Log_email = v_Log_email & vbCrLf & "- " & v_Cliente & " - " & v_Tp_Doc & " N. " & v_N_Doc
        End If
        
        rs.MoveNext
    Loop

    v_Log = "Envio de e-mail's com as faturas dos clientes terminado." & vbCrLf & vbCrLf & _
            "N.º de e-mail's enviados: " & v_CountEmail & vbCrLf & _
            "N.º de e-mail's com ERRO no endereço: " & v_CountEmail_err & vbCrLf & vbCrLf & _
            v_Log_endereco & vbCrLf & vbCrLf & _
            v_Log_s_anexo
    
    
    '*** Enviar email com log ***
    'Dim objOutlook As Object  -- Já definido
    'Dim objMailItem As Object  -- Já definido
    'Const olMailItem As Integer = 0  -- Já definido
    Set objOutlook = CreateObject("Outlook.Application")
    Set objMailItem = objOutlook.CreateItem(olMailItem)
    'set sender
    'objMailItem.SentOnBehalfOfName =  -- O e-mail sairá da conta do utilizador
    'set receipient
    objMailItem.To = v_From  '-- E-mail enviado para o grupo
    'set subject
    objMailItem.Subject = "Log envio de E-mail's - Faturação a Clientes"
    'set body content
    objMailItem.Body = v_Log & vbCrLf & vbCrLf & v_Log_email
    'sending email
    objMailItem.Send
    
    MsgBox v_Log, vbInformation, "Envio de e-mail"

End If

Set objOutlook = Nothing
Set objMailItem = Nothing

rs.Close
Set rs = Nothing

exit_Error_handler:
    On Error Resume Next

    Set objOutlook = Nothing
    Set objMailItem = Nothing

    Exit Sub
 
err_Error_handler:
    Select Case Err.Number
    'trap error 287
    Case 287
        MsgBox "Canceled by user.", vbInformation
    Case -2147467259
        v_CountEmail = v_CountEmail - 1
        v_CountEmail_err = v_CountEmail_err + 1

        If v_Log_endereco = "" Then
            v_Log_endereco = "E-mail's NÃO enviados por existir ERRO no endereço:" & vbCrLf & _
                            "- " & v_Cliente & " - " & v_Tp_Doc & " N. " & v_N_Doc
        Else
            v_Log_endereco = v_Log_endereco & vbCrLf & "- " & v_Cliente & " - " & v_Tp_Doc & " N. " & v_N_Doc
        End If
        
        Resume Next
    Case Else
        MsgBox "Error " & Err.Number & " " & Err.description & vbCrLf & v_Cliente & " - " & v_Tp_Doc & " N. " & v_N_Doc
    End Select

Resume exit_Error_handler


End Sub

Private Sub B_Enviado_email_upd_Click()

Dim v_SQL_upd_imp As String
v_SQL_upd_imp = ""

If (IsNull(Me.whr_aux) Or Me.whr_aux = "") Then
    v_SQL_upd_imp = "UPDATE Facturacao SET Facturacao.Imprimiu = True " _
                    & "WHERE (((Facturacao.Imprimiu)=False) AND ((Facturacao.Imp_Block)=False Or (Facturacao.Imp_Block) Is Null))"
Else
    v_SQL_upd_imp = "UPDATE Facturacao SET Facturacao.Imprimiu = True " _
                    & "WHERE (((Facturacao.Imprimiu)=False) AND ((Facturacao.Imp_Block)=False Or (Facturacao.Imp_Block) Is Null) AND " & Me.whr_aux & ")"
End If

'MsgBox v_SQL_upd_imp

DoCmd.SetWarnings False
DoCmd.RunSQL v_SQL_upd_imp
DoCmd.SetWarnings True

Me.B_Enviado_email_upd.Enabled = False

Call B_Limpar_Click

MsgBox "A faturação foi marcada como enviada!!", vbInformation, "Enviar Faturas"

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

Private Sub B_Atualizar_Click()

Dim qry As String
Dim whr As String

qry = "select * from E_Mail_Env_list"

If Not IsNull(Me.F_DT_Fat_i) Then
    If whr = "" Then
        whr = "[DT_Doc_FT] >= #" & Format(Me.F_DT_Fat_i, "mm\/dd\/yyyy") & "#"
    Else
        whr = whr & " and [DT_Doc_FT] >= #" & Format(Me.F_DT_Fat_i, "mm\/dd\/yyyy") & "#"
    End If
End If

If Not IsNull(Me.F_DT_Fat_f) Then
    If whr = "" Then
        whr = "[DT_Doc_FT] <= #" & Format(Me.F_DT_Fat_f, "mm\/dd\/yyyy") & "#"
    Else
        whr = whr & " and [DT_Doc_FT] <= #" & Format(Me.F_DT_Fat_f, "mm\/dd\/yyyy") & "#"
    End If
End If

'If Not IsNull(Me.F_Cliente) Then
'    If whr = "" Then
'        whr = "[Nome] like '*" & Me.F_Cliente & "*'"
'    Else
'        whr = whr & " and [Nome] like '*" & Me.F_Cliente & "*'"
'    End If
'End If

'If Not IsNull(Me.F_Tp_Order) Then
'    If whr = "" Then
'        whr = "[ID_Tp_Order] = '" & Me.F_Tp_Order & "'"
'    Else
'        whr = whr & " and [ID_Tp_Order] = '" & Me.F_Tp_Order & "'"
'    End If
'End If

If Not IsNull(Me.F_Fat_i) Then
    If whr = "" Then
        whr = "[N_Doc_FT] >= '" & Me.F_Fat_i & "'"
    Else
        whr = whr & " and [N_Doc_FT] >= '" & Me.F_Fat_i & "'"
    End If
End If

If Not IsNull(Me.F_Fat_f) Then
    If whr = "" Then
        whr = "[N_Doc_FT] <= '" & Me.F_Fat_f & "'"
    Else
        whr = whr & " and [N_Doc_FT] <= '" & Me.F_Fat_f & "'"
    End If
End If

Me.whr_aux = whr

E_Mail_Env_List.Visible = False
Me.E_Mail_Env_List.SourceObject = "E_Mail_Env_Sub"

If whr = "" Then
    Me.E_Mail_Env_List.Form.RecordSource = qry & " order by [DT_Doc_FT] desc, [N_Doc_FT] desc"
Else
    Me.E_Mail_Env_List.Form.RecordSource = qry & " where " & whr & " order by [DT_Doc_FT] desc, [N_Doc_FT] desc"
End If

E_Mail_Env_List.Visible = True

Me.B_Enviado_email_upd.Enabled = True

End Sub

Private Sub B_Limpar_Click()

Me.F_Fat_i = Null
Me.F_Fat_f = Null
Me.F_DT_Fat_i = Null
Me.F_DT_Fat_f = Null
Me.whr_aux = Null
Me.E_Mail_Env_List.SourceObject = ""
Me.B_Enviado_email_upd.Enabled = False
Me.Refresh

End Sub

Private Sub F_DT_Fat_f_Change()

Me.B_Enviado_email_upd.Enabled = False

End Sub

Private Sub F_DT_Fat_i_Change()

Me.B_Enviado_email_upd.Enabled = False

End Sub

Private Sub F_Fat_f_Change()

Me.B_Enviado_email_upd.Enabled = False

End Sub

Private Sub F_Fat_i_Change()

Me.B_Enviado_email_upd.Enabled = False

End Sub
