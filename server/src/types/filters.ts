/** Orders list filters as they arrive from the validated request body. */
export type OrderListFilters = {
  dateFrom?: string
  dateTo?: string
  clientName?: string
  orderFactory?: boolean
  idTpOrder?: string[]
  idArea?: string[]
  idTipo?: string[]
  idProduto?: number[]
  idInstrumento?: number[]
  encomendaCliPHC?: string
  invoiceNumber?: string
  negocioFechado?: boolean
}

/** Clients list filters as they arrive from the validated request body. */
export type ClientListFilters = {
  search?: string
  idTpCliente?: number[]
}
