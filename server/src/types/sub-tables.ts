/**
 * Order sub-table wire types.
 *
 * Field names mirror the frontend models exactly
 * (app/src/domain/models/reconhecimento.ts, documento-faturacao.ts) so the
 * HTTP repos map cleanly. `upsize_ts` is intentionally omitted (opaque,
 * never serialized). Verified against the demo schema.
 */

export type ReconhecimentoRow = {
  ID_Reconhecimento: number
  ID_Order: number
  ID_Tp_Reconhecimento: string | null
  DT_Reconhecimento: string | null
  Valor_Reconhecimento: number | null
  ID_User: string | null
  DT_User: string | null
}

export type DocumentoFaturacaoTypeRow = {
  id: string
  label: string
}

export type DocumentoFaturacaoRow = {
  ID_Facturacao: number
  ID_Order: number
  DT_Doc_FT: string | null
  ID_Tp_Doc_FT: string | null
  N_Doc_FT: string | null
  Valor_Doc_FT: number | null
  ID_User: string | null
  DT_User: string | null
  Imprimiu?: boolean | null
  Imp_Block?: boolean | null
  Nome_PDF?: string | null
  E_Invoice?: boolean | null
  SAP_Order_Number?: string | null
  Client_Name?: string | null
  Order_Email?: string | null
  Order_Contact?: string | null
  Order_PO?: string | null
}

export type OkReconhecimentos = {
  ok: true
  rows: ReconhecimentoRow[]
}

export type OkFacturacao = {
  ok: true
  rows: DocumentoFaturacaoRow[]
}

// Kit_Consumables sub-table. Mirrors dbo.Kit_Consumables: ID_Kit int PK
// (identity), ID_Order int (→ dbo.[Order]), Date datetime,
// Internal_Order/Material/Description nvarchar, Quant int, Unit_Price/Total_Price money.
// Unlike Reconhecimento/Facturacao this table has no ID_User/DT_User audit columns, so
// none are exposed. Field names mirror app/src/domain/models/kit-consumable.ts exactly.
export type KitConsumableRow = {
  ID_Kit: number
  ID_Order: number
  Date: string | null
  Internal_Order: string | null
  Material: string | null
  Description: string | null
  Quant: number | null
  Unit_Price: number | null
  Total_Price: number | null
}

export type OkKitConsumables = {
  ok: true
  rows: KitConsumableRow[]
}

export type NewKitConsumableInput = {
  ID_Order: number
  Date: string
  Internal_Order: string
  Material: string
  Description: string
  Quant: number
  Unit_Price: number
  Total_Price: number
}

export type KitConsumablePatch = Partial<
  Pick<
    KitConsumableRow,
    'Date' | 'Internal_Order' | 'Material' | 'Description' | 'Quant' | 'Unit_Price' | 'Total_Price'
  >
>

export type NewReconhecimentoInput = {
  ID_Order: number
  ID_Tp_Reconhecimento: string
  DT_Reconhecimento: string
  Valor_Reconhecimento: number
}

export type NewFacturacaoInput = {
  ID_Order: number
  DT_Doc_FT: string
  ID_Tp_Doc_FT: string
  N_Doc_FT: string
  Valor_Doc_FT: number
}

export type ReconhecimentoPatch = Partial<
  Pick<ReconhecimentoRow, 'ID_Tp_Reconhecimento' | 'DT_Reconhecimento' | 'Valor_Reconhecimento'>
>

export type FacturacaoPatch = Partial<
  Pick<
    DocumentoFaturacaoRow,
    | 'DT_Doc_FT'
    | 'ID_Tp_Doc_FT'
    | 'N_Doc_FT'
    | 'Valor_Doc_FT'
    | 'Imprimiu'
    | 'Imp_Block'
    | 'Nome_PDF'
    | 'E_Invoice'
  >
>

export type PropagateReconhecimentoInput =
  | {
      orderId: number
      kind: 'warranty'
    }
  | {
      orderId: number
      kind: 'maintenance'
      startDate: string
      years: number
      recognitionDate: string
    }
