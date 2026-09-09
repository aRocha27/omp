export interface BacklogReportRow {
  ano: number | null; mes: number | null; idOrder: number | null; idArea: string | null; area: string | null
  idTipo: string | null; tipo: string | null; idGrpReport: number | null; grpReport: string | null
  idProduto: number | null; produto: string | null; encomendaCliPHC: string | null
  backlogStart: number; nob: number; revenue: number; backlogEnd: number
}

export interface YearlyBacklogReportRow {
  ano: number | null
  backlogStart: number
  nob: number
  revenue: number
  backlogEnd: number
}
