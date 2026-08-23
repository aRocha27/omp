VERSION 1.0 CLASS
BEGIN
  MultiUse = -1  'True
END
Attribute VB_Name = "Form_M_Mapas"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = True
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Compare Database

Private Sub B_Excel_Click()

If Me.B_Excel = True Then
    Me.B_Relatorio = False
Else
    Me.B_Relatorio = True
End If

End Sub

Private Sub B_Relatorio_Click()

If Me.B_Relatorio = True Then
    Me.B_Excel = False
Else
    Me.B_Excel = True
End If

End Sub

Private Sub Command175_Click()

If IsNull(Me.F_DT_i) And IsNull(Me.F_DT_f) Then
    MsgBox "É necessário definir algum tipo de 'DATAS'!!!", vbExclamation, "Mapas e Listagens"
Else
'*** ESTE IF (FCHADO APENAS NO FIM) OBRIGA HAVER DATAS

Dim v_Area As String
Dim v_Tipo As String
Dim v_Produto As String
Dim v_Tp_Cliente As String
Dim F_Tp_Revenue As String

Dim v_msg As String
Dim v_tit As String
Dim v_rpt_nome As String
Dim v_rpt_whr As String
Dim v_rpt_whrDT As String
Dim v_rpt_whr_DT As String
Dim v_qrySQL_rpt As String
Dim qdf As DAO.QueryDef

v_msg = ""
v_rpt_whr = ""
v_rpt_whrDT = ""
v_qrySQL_rpt = ""

If Not IsNull(Me.F_DT_i) Then
    If v_msg = "" Then
        v_msg = "DT >= " & Format(Forms![M_Mapas]!F_DT_i, "dd/mm/yyyy")
    Else
        v_msg = v_msg & "; DT >= " & Format(Forms![M_Mapas]!F_DT_i, "dd/mm/yyyy")
    End If
    If v_rpt_whrDT = "" Then
        v_rpt_whrDT = "([DT] >= #" & Format(Forms![M_Mapas]!F_DT_i, "mm\/dd\/yyyy") & "#)"
    Else
        v_rpt_whrDT = v_rpt_whrDT & " and ([DT] >= #" & Format(Forms![M_Mapas]!F_DT_i, "mm\/dd\/yyyy") & "#)"
    End If
End If

If Not IsNull(Me.F_DT_f) Then
    If v_msg = "" Then
        v_msg = "DT <= " & Format(Forms![M_Mapas]!F_DT_f, "dd/mm/yyyy")
    Else
        v_msg = v_msg & "; DT <= " & Format(Forms![M_Mapas]!F_DT_f, "dd/mm/yyyy")
    End If
    If v_rpt_whrDT = "" Then
        v_rpt_whrDT = "([DT] <= #" & Format(Forms![M_Mapas]!F_DT_f, "mm\/dd\/yyyy") & "#)"
    Else
        v_rpt_whrDT = v_rpt_whrDT & " and ([DT] <= #" & Format(Forms![M_Mapas]!F_DT_f, "mm\/dd\/yyyy") & "#)"
    End If
End If

If Not IsNull(Me.F_Area) Then
    v_Area = DLookup("Area", "[Area]", "([ID_Area]= '" & Forms![M_Mapas]![F_Area] & "')")
    If v_msg = "" Then
        v_msg = "Area: " & v_Area
    Else
        v_msg = v_msg & "; Area: " & v_Area
    End If
    If v_rpt_whr = "" Then
        v_rpt_whr = "([ID_Area] = '" & Forms![M_Mapas]![F_Area] & "')"
    Else
        v_rpt_whr = v_rpt_whr & " and ([ID_Area] = '" & Forms![M_Mapas]![F_Area] & "')"
    End If
End If

If Not IsNull(Me.F_Tipo) Then
    v_Tipo = DLookup("Tipo", "[Tipo]", "([ID_Tipo]= '" & Forms![M_Mapas]![F_Tipo] & "')")
    If v_msg = "" Then
        v_msg = "Tipo: " & v_Tipo
    Else
        v_msg = v_msg & "; Tipo: " & v_Tipo
    End If
    If v_rpt_whr = "" Then
        v_rpt_whr = "([ID_Tipo] = '" & Forms![M_Mapas]![F_Tipo] & "')"
    Else
        v_rpt_whr = v_rpt_whr & " and ([ID_Tipo] = '" & Forms![M_Mapas]![F_Tipo] & "')"
    End If
End If

If Not IsNull(Me.F_Produto) Then
    v_Produto = DLookup("Produto", "[Produto]", "([ID_Produto]=forms![M_Mapas]![F_Produto])")
    If v_msg = "" Then
        v_msg = "Produto: " & v_Produto
    Else
        v_msg = v_msg & "; Produto: " & v_Produto
    End If
    If v_rpt_whr = "" Then
        v_rpt_whr = "([ID_Produto] =" & Forms![M_Mapas]![F_Produto] & ")"
    Else
        v_rpt_whr = v_rpt_whr & " and ([ID_Produto] =" & Forms![M_Mapas]![F_Produto] & ")"
    End If
End If

If Not IsNull(Me.F_Tp_Cliente) Then
    v_Tp_Cliente = DLookup("Tp_Cliente", "[Tp_Cliente]", "([ID_Tp_Cliente]=forms![M_Mapas]![F_Tp_Cliente])")
    If v_msg = "" Then
        v_msg = "Tp Cliente: " & v_Tp_Cliente
    Else
        v_msg = v_msg & "; Tp Cliente: " & v_Tp_Cliente
    End If
    If v_rpt_whr = "" Then
        v_rpt_whr = "([ID_Tp_Cliente] =" & Forms![M_Mapas]![F_Tp_Cliente] & ")"
    Else
        v_rpt_whr = v_rpt_whr & " and ([ID_Tp_Cliente] =" & Forms![M_Mapas]![F_Tp_Cliente] & ")"
    End If
End If

If Not IsNull(Me.F_Tp_Revenue) Then
    v_Tp_Revenue = DLookup("Tp_Revenue", "[Tp_Revenue]", "([ID_Tp_Revenue]=forms![M_Mapas]![F_Tp_Revenue])")
    If v_msg = "" Then
        v_msg = "Tp Revenue: " & v_Tp_Revenue
    Else
        v_msg = v_msg & "; Tp Revenue: " & v_Tp_Revenue
    End If
    If v_rpt_whr = "" Then
        v_rpt_whr = "([ID_Tp_Revenue] =" & Forms![M_Mapas]![F_Tp_Revenue] & ")"
    Else
        v_rpt_whr = v_rpt_whr & " and ([ID_Tp_Revenue] =" & Forms![M_Mapas]![F_Tp_Revenue] & ")"
    End If
End If

If v_msg = "" Then
    Me.Filtro_Desc = "Sem filtros"
Else
    Me.Filtro_Desc = v_msg
    'MsgBox v_msg
    'MsgBox v_rpt_whr
    'MsgBox v_rpt_whrDT
End If

If v_rpt_whr = "" Then
    v_rpt_whr_DT = v_rpt_whrDT
Else
    v_rpt_whr_DT = v_rpt_whr & " and " & v_rpt_whrDT
End If

For Each qdf In CurrentDb.QueryDefs
  If qdf.Name = "qry_EXP" Then
    CurrentDb.QueryDefs.Delete "qry_EXP"
    Exit For
  End If
Next

If Me.F_Mapa = 1 Then
    DoCmd.SetWarnings False
        DoCmd.RunSQL "DELETE * FROM Producao_rpt"
        DoCmd.OpenQuery "rpt_Producao_BL_i", acViewNormal
        DoCmd.OpenQuery "rpt_Producao_BL_i_warranty", acViewNormal
        DoCmd.OpenQuery "rpt_Producao_BL_f", acViewNormal
        DoCmd.OpenQuery "rpt_Producao_BL_f_warranty", acViewNormal
        DoCmd.OpenQuery "rpt_Producao_NOB", acViewNormal
        DoCmd.OpenQuery "rpt_Producao_NOB_Warranty", acViewNormal
        DoCmd.OpenQuery "rpt_Producao_Revenue", acViewNormal
        DoCmd.OpenQuery "rpt_Producao_Revenue_warranty", acViewNormal
    DoCmd.SetWarnings True
    v_tit = "Produção por Área e Tipo"
    v_rpt_nome = "Producao_AT"
    If v_rpt_whr = "" Then
        v_qrySQL_rpt = "SELECT * FROM rpt_Producao_AT;"
    Else
        v_qrySQL_rpt = "SELECT * FROM rpt_Producao_AT WHERE " & v_rpt_whr & ";"
    End If
    Me.qrySQL_rpt_aux = v_qrySQL_rpt
    Me.Titulo_Mapa = InputBox("Definir o Título para o relatório: " & Chr(10) & Chr(10) & Me.Filtro_Desc, "Título do Relatório", v_tit)

If Me.B_Relatorio = True Then
    DoCmd.OpenReport v_rpt_nome, acViewPreview, , v_rpt_whr, acWindowNormal
Else
'    CurrentDb.QueryDefs.Delete "qry_EXP"
    Set qdf = CurrentDb.CreateQueryDef("qry_EXP", v_qrySQL_rpt)
    DoCmd.OutputTo acOutputQuery, "qry_exp", acFormatXLS, Me.Titulo_Mapa & ".xls", True
    CurrentDb.QueryDefs.Delete "qry_EXP"
    Set qdf = Nothing
End If
End If

If Me.F_Mapa = 2 Then
    DoCmd.SetWarnings False
        DoCmd.RunSQL "DELETE * FROM Producao_rpt"
        DoCmd.OpenQuery "rpt_Producao_BL_i", acViewNormal
        DoCmd.OpenQuery "rpt_Producao_BL_i_warranty", acViewNormal
        DoCmd.OpenQuery "rpt_Producao_BL_f", acViewNormal
        DoCmd.OpenQuery "rpt_Producao_BL_f_warranty", acViewNormal
        DoCmd.OpenQuery "rpt_Producao_NOB", acViewNormal
        DoCmd.OpenQuery "rpt_Producao_NOB_Warranty", acViewNormal
        DoCmd.OpenQuery "rpt_Producao_Revenue", acViewNormal
        DoCmd.OpenQuery "rpt_Producao_Revenue_warranty", acViewNormal
    DoCmd.SetWarnings True
    v_tit = "Produção por Área, Tipo e Produto"
    v_rpt_nome = "Producao_ATP"
    If v_rpt_whr = "" Then
        v_qrySQL_rpt = "SELECT * FROM rpt_Producao_ATP;"
    Else
        v_qrySQL_rpt = "SELECT * FROM rpt_Producao_ATP WHERE " & v_rpt_whr & ";"
    End If
    Me.qrySQL_rpt_aux = v_qrySQL_rpt
    Me.Titulo_Mapa = InputBox("Definir o Título para o relatório: " & Chr(10) & Chr(10) & Me.Filtro_Desc, "Título do Relatório", v_tit)
    
If Me.B_Relatorio = True Then
    DoCmd.OpenReport v_rpt_nome, acViewPreview, , v_rpt_whr, acWindowNormal
Else
'    CurrentDb.QueryDefs.Delete "qry_EXP"
    Set qdf = CurrentDb.CreateQueryDef("qry_EXP", v_qrySQL_rpt)
    DoCmd.OutputTo acOutputQuery, "qry_exp", acFormatXLS, Me.Titulo_Mapa & ".xls", True
    CurrentDb.QueryDefs.Delete "qry_EXP"
    Set qdf = Nothing
End If
End If

'If Me.F_Mapa = 3 Then
'    v_tit = "Mapa Anual - NOB"
'    v_rpt_nome = "Anual_NOB"
'    Me.Titulo_Mapa = InputBox("Definir o Título para o relatório: " & Chr(10) & Chr(10) & Me.Filtro_Desc, "Título do Relatório", v_tit)
'    DoCmd.OpenReport v_rpt_nome, acViewPreview, , v_rpt_whr, acWindowNormal
'End If

If Me.F_Mapa = 81 Then
    v_tit = "Report - NOB"
    v_rpt_nome = "R_NOB"
    
    DoCmd.SetWarnings False
        DoCmd.RunSQL "DELETE * FROM rpt_R_NOB"
        DoCmd.OpenQuery "rpt_R_NOB_sem_warranty", acViewNormal
        DoCmd.OpenQuery "rpt_R_NOB_warranty", acViewNormal
    DoCmd.SetWarnings True

    v_qrySQL_rpt = "SELECT rpt_R_NOB.DT_AM, rpt_R_NOB.Mes as MES, rpt_R_NOB.Area as AREA, rpt_R_NOB.Grp_Report as TIPO, rpt_R_NOB.Produto as PRODUTO, Sum(rpt_R_NOB.Sell_Price) AS SELL_PRICE" _
                & " FROM ( SELECT * FROM rpt_R_NOB WHERE " & v_rpt_whr_DT & " )" _
                & " GROUP BY rpt_R_NOB.DT_AM, rpt_R_NOB.Mes, rpt_R_NOB.Area, rpt_R_NOB.Grp_Report, rpt_R_NOB.Produto" _
                & " ORDER BY rpt_R_NOB.DT_AM, rpt_R_NOB.Mes, rpt_R_NOB.Area, rpt_R_NOB.Grp_Report, rpt_R_NOB.Produto;"
    Me.qrySQL_rpt_aux = v_qrySQL_rpt
    Me.Titulo_Mapa = InputBox("Definir o Título para o relatório: " & Chr(10) & Chr(10) & Me.Filtro_Desc, "Título do Relatório", v_tit)

If Me.B_Relatorio = True Then
    DoCmd.OpenReport v_rpt_nome, acViewPreview, , , acWindowNormal
Else
'    CurrentDb.QueryDefs.Delete "qry_EXP"
    Set qdf = CurrentDb.CreateQueryDef("qry_EXP", v_qrySQL_rpt)
    DoCmd.OutputTo acOutputQuery, "qry_exp", acFormatXLS, v_rpt_nome & ".xls", True
    CurrentDb.QueryDefs.Delete "qry_EXP"
    Set qdf = Nothing
End If
End If

If Me.F_Mapa = 82 Then
    v_tit = "Report - NOB by Geogr Region"
    v_rpt_nome = "R_NOB_Geog"
    
    DoCmd.SetWarnings False
        DoCmd.RunSQL "DELETE * FROM rpt_R_NOB"
        DoCmd.OpenQuery "rpt_R_NOB_sem_warranty", acViewNormal
        DoCmd.OpenQuery "rpt_R_NOB_warranty", acViewNormal
    DoCmd.SetWarnings True
   
    
    v_qrySQL_rpt = "SELECT * FROM rpt_R_NOB WHERE " & v_rpt_whr_DT & "ORDER BY rpt_R_NOB.Grp_Report, rpt_R_NOB.Area;"
    Me.qrySQL_rpt_aux = v_qrySQL_rpt
    Me.Titulo_Mapa = InputBox("Definir o Título para o relatório: " & Chr(10) & Chr(10) & Me.Filtro_Desc, "Título do Relatório", v_tit)

If Me.B_Relatorio = True Then
    DoCmd.OpenReport v_rpt_nome, acViewPreview, , , acWindowNormal
Else
    v_qrySQL_rpt = "SELECT Area &'-'& Produto as Nature_of_NOB, Tp_Revenue as Type_of_NOB, 'PT-Portugal' as Country_Code," _
                & " 'Portugal' as Country, DateSerial(Year([DT]),Month([DT]),1) as Date_NOB, Sell_Price, ID_Tipo, GRP_Report" _
                & " FROM rpt_R_NOB WHERE " & v_rpt_whr_DT & " ORDER BY DT, Area, Produto;"

'    CurrentDb.QueryDefs.Delete "qry_EXP"
    Set qdf = CurrentDb.CreateQueryDef("qry_EXP", v_qrySQL_rpt)
    DoCmd.OutputTo acOutputQuery, "qry_exp", acFormatXLS, v_rpt_nome & ".xls", True
    CurrentDb.QueryDefs.Delete "qry_EXP"
    Set qdf = Nothing
End If
End If

If Me.F_Mapa = 83 Then
    v_tit = "Report - Revenue"
    v_rpt_nome = "R_Revenue"
    v_qrySQL_rpt = "SELECT rpt_R_Revenue.DT_AM, rpt_R_Revenue.Mes as MES, rpt_R_Revenue.Area as AREA, rpt_R_Revenue.Grp_Report as TIPO, rpt_R_Revenue.Produto as PRODUTO, Sum(rpt_R_Revenue.Valor_Reconhecimento) AS REVENUE" _
                & " FROM ( SELECT * FROM rpt_R_Revenue WHERE " & v_rpt_whr_DT & " )" _
                & " GROUP BY rpt_R_Revenue.DT_AM, rpt_R_Revenue.Mes, rpt_R_Revenue.Area, rpt_R_Revenue.Grp_Report, rpt_R_Revenue.Produto" _
                & " ORDER BY rpt_R_Revenue.DT_AM, rpt_R_Revenue.Mes, rpt_R_Revenue.Area, rpt_R_Revenue.Grp_Report, rpt_R_Revenue.Produto;"
    Me.qrySQL_rpt_aux = v_qrySQL_rpt
    Me.Titulo_Mapa = InputBox("Definir o Título para o relatório: " & Chr(10) & Chr(10) & Me.Filtro_Desc, "Título do Relatório", v_tit)

If Me.B_Relatorio = True Then
    DoCmd.OpenReport v_rpt_nome, acViewPreview, , , acWindowNormal
Else
'    CurrentDb.QueryDefs.Delete "qry_EXP"
    Set qdf = CurrentDb.CreateQueryDef("qry_EXP", v_qrySQL_rpt)
    DoCmd.OutputTo acOutputQuery, "qry_exp", acFormatXLS, v_rpt_nome & ".xls", True
    CurrentDb.QueryDefs.Delete "qry_EXP"
    Set qdf = Nothing
End If
End If

If Me.F_Mapa = 84 Then
    v_tit = "Report - Revenue by Geogr Region"
    v_rpt_nome = "R_Revenue_Geog"
    v_qrySQL_rpt = "SELECT * FROM rpt_R_Revenue WHERE " & v_rpt_whr_DT & "ORDER BY rpt_R_Revenue.Grp_Report, rpt_R_Revenue.Area, rpt_R_Revenue.Produto;"
    Me.qrySQL_rpt_aux = v_qrySQL_rpt
    Me.Titulo_Mapa = InputBox("Definir o Título para o relatório: " & Chr(10) & Chr(10) & Me.Filtro_Desc, "Título do Relatório", v_tit)

If Me.B_Relatorio = True Then
    DoCmd.OpenReport v_rpt_nome, acViewPreview, , , acWindowNormal
Else
    v_qrySQL_rpt = "SELECT Tp_Cliente as Customer_Type, Area &'-'& Produto as Nature_of_Sale, Tp_Revenue as Type_of_Revenue," _
                & " nome as Name_Customer, 'PT-Portugal' as Country_Code, 'Portugal' as Country, iif([Defense]=true,'Yes','No')" _
                & " as Defen, DateSerial(Year([DT]),Month([DT]),1) as Date_Revenue, 'Eur' as Currenc, Valor_Reconhecimento as Revenue " _
                & " FROM rpt_R_Revenue WHERE " & v_rpt_whr_DT & " ORDER BY DT, Area, Produto;"

'    CurrentDb.QueryDefs.Delete "qry_EXP"
    Set qdf = CurrentDb.CreateQueryDef("qry_EXP", v_qrySQL_rpt)
    DoCmd.OutputTo acOutputQuery, "qry_exp", acFormatXLS, v_rpt_nome & ".xls", True
    CurrentDb.QueryDefs.Delete "qry_EXP"
    Set qdf = Nothing
End If
End If

If Me.F_Mapa = 85 Then
If IsNull(Me.F_DT_f) Then
    MsgBox "É necessário definir a DATA 'fim'!!!", vbExclamation, "Mapas e Listagens"
Else
'*** ESTE IF (FCHADO APENAS NO FIM DESTE REPORT) OBRIGA HAVER DATA FIM

    v_tit = "Report - Backlog"
    v_rpt_nome = "R_Backlog"
    DoCmd.SetWarnings False
        DoCmd.RunSQL "DELETE * FROM Producao_rpt"
        DoCmd.OpenQuery "rpt_Producao_BL_f", acViewNormal
        DoCmd.OpenQuery "rpt_Producao_BL_f_warranty", acViewNormal
        DoCmd.OpenQuery "rpt_R_Backlog_Ship", acViewNormal
    DoCmd.SetWarnings True
    If v_rpt_whr = "" Then
        v_qrySQL_rpt = "SELECT * FROM rpt_R_Backlog ORDER BY rpt_R_Backlog.DT_Order, rpt_R_Backlog.Area, rpt_R_Backlog.Produto;"
    Else
        v_qrySQL_rpt = "SELECT * FROM rpt_R_Backlog WHERE " & v_rpt_whr & "ORDER BY rpt_R_Backlog.DT_Order, rpt_R_Backlog.Area, rpt_R_Backlog.Produto;"
    End If
    Me.qrySQL_rpt_aux = v_qrySQL_rpt
    Me.Titulo_Mapa = InputBox("Definir o Título para o relatório: " & Chr(10) & Chr(10) & Me.Filtro_Desc, "Título do Relatório", v_tit)

If Me.B_Relatorio = True Then
    DoCmd.OpenReport v_rpt_nome, acViewPreview, , , acWindowNormal
Else
    If v_rpt_whr = "" Then
       v_qrySQL_rpt = "SELECT 'PT-Portugal' as Country, [nome] as Name_Customer, [Encomenda_Cli_PHC] as Order_Number, [Tp_Cliente] as Customer_Type, 'NA' as Costumer_SAP_N," _
                & " [DT_Order] as Date_PO, NOB, 'NA' as SAP_Order_N," _
                & " [Area] as Division, [Tipo] as Type, [Produto] as Product_Line, Backlog_f as Backlog," _
                & " '' as Delibery_PO, '' as Delibery_Actual, '' as Estimated_PO, '' as Latested_Estimate," _
                & " ProductionX as Prodution, ShipX as Ship" _
                & " FROM rpt_R_Backlog ORDER BY DT_Order, Area, Produto;"
    Else
       v_qrySQL_rpt = "SELECT 'PT-Portugal' as Country, [nome] as Name_Customer, [Tp_Cliente] as Customer_Type, 'NA' as Costumer_SAP_N," _
                & " [DT_Order] as Date_PO, NOB, 'NA' as SAP_Order_N," _
                & " [Area] as Division, [Tipo] as Type, [Produto] as Product_Line, Backlog_f as Backlog," _
                & " '' as Delibery_PO, '' as Delibery_Actual, '' as Estimated_PO, '' as Latested_Estimate," _
                & " ProductionX as Prodution, ShipX as Ship" _
                & " FROM rpt_R_Backlog WHERE " & v_rpt_whr & " ORDER BY DT_Order, Area, Produto;"
    End If

'    CurrentDb.QueryDefs.Delete "qry_EXP"
    Set qdf = CurrentDb.CreateQueryDef("qry_EXP", v_qrySQL_rpt)
    DoCmd.OutputTo acOutputQuery, "qry_exp", acFormatXLS, v_rpt_nome & ".xls", True
    CurrentDb.QueryDefs.Delete "qry_EXP"
    Set qdf = Nothing
End If
End If ' Fechar o IF da DATA FIM
End If

'*** FECHAR O IF (DO INICIO) QUE OBRIGA HAVER DATAS
End If

End Sub

Private Sub Command176_Click()

Me.F_DT_i = Null
Me.F_DT_f = Null
Me.F_Area = Null
Me.F_Tipo = Null
Me.F_Produto = Null
Me.F_Tp_Cliente = Null
Me.F_Tp_Revenue = Null

Me.Filtro_Desc = "Sem filtros"

Me.Refresh

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

Private Sub F_Area_AfterUpdate()

Me.F_Produto.Requery

End Sub

Private Sub F_Mapa_Click()

Me.F_DT_i.Enabled = True
Me.F_DT_f.Enabled = True
Me.F_Area.Enabled = True
Me.F_Tipo.Enabled = True
Me.F_Produto.Enabled = True
Me.F_Tp_Cliente.Enabled = True
Me.F_Tp_Revenue.Enabled = True

If Me.F_Mapa = 1 Then
    Me.F_Produto.Enabled = False
    Me.F_Produto = Null
    Me.F_Tp_Cliente.Enabled = False
    Me.F_Tp_Cliente = Null
    Me.F_Tp_Revenue.Enabled = False
    Me.F_Tp_Revenue = Null
End If

If Me.F_Mapa = 2 Then
    Me.F_Tp_Cliente.Enabled = False
    Me.F_Tp_Cliente = Null
    Me.F_Tp_Revenue.Enabled = False
    Me.F_Tp_Revenue = Null
End If

End Sub

Private Sub Form_Current()

Me.F_DT_i.Enabled = True
Me.F_DT_f.Enabled = True
Me.F_Area.Enabled = True
Me.F_Tipo.Enabled = True
Me.F_Produto.Enabled = True
Me.F_Tp_Cliente.Enabled = True
Me.F_Tp_Revenue.Enabled = True

If Me.F_Mapa = 1 Then
    Me.F_Produto.Enabled = False
    Me.F_Produto = Null
    Me.F_Tp_Cliente.Enabled = False
    Me.F_Tp_Cliente = Null
    Me.F_Tp_Revenue.Enabled = False
    Me.F_Tp_Revenue = Null
End If

If Me.F_Mapa = 2 Then
    Me.F_Tp_Cliente.Enabled = False
    Me.F_Tp_Cliente = Null
    Me.F_Tp_Revenue.Enabled = False
    Me.F_Tp_Revenue = Null
End If

Me.B_Relatorio = True
Me.B_Excel = False

End Sub
