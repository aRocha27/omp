import {
  booleanOrNull,
  dateTimeOrEmpty,
  dateTimeOrNull,
  numberOrNull,
  numberOrThrow,
  stringOrNull,
} from './sql-helpers.js'
import type {
  ClientDetailRow,
  ClientSummaryRow,
  DocumentoFaturacaoRow,
  KitConsumableRow,
  OrderDetailRow,
  OrderSummaryRow,
  ReconhecimentoRow,
} from '../types/index.js'

export function toSummaryRow(row: Record<string, unknown>): OrderSummaryRow {
  return {
    ID_Order: numberOrThrow(row, 'ID_Order'),
    // DT_Order is NOT NULL on the live table; the empty-string fallback is defensive only
    // (a stray null would render as "—" rather than 502 the whole list). mssql returns
    // datetime columns as JS Date objects — coerce to ISO 8601 UTC (TIMEZONE.md) so the
    // wire contract is a stable ISO string, never a Date.toString() locale dump.
    DT_Order: dateTimeOrEmpty(row['DT_Order']),
    Order_Factory: booleanOrNull(row['Order_Factory']),
    ID_Tp_Order: stringOrNull(row['ID_Tp_Order']),
    ID_Client: numberOrNull(row['ID_Client']),
    Client_Name: stringOrNull(row['Client_Name']),
    ID_Area: stringOrNull(row['ID_Area']),
    ID_Tipo: stringOrNull(row['ID_Tipo']),
    ID_Produto: numberOrNull(row['ID_Produto']),
    ID_Instrumento: numberOrNull(row['ID_Instrumento']),
    Sell_Price: numberOrNull(row['Sell_Price']),
    Negocio_Fechado: booleanOrNull(row['Negocio_Fechado']),
    Encomenda_Cli_PHC: stringOrNull(row['Encomenda_Cli_PHC']),
    // Order-table-only columns joined from dbo.[Order]. When the LEFT JOIN found no base
    // row these come back null and render as "—" — they never break the list.
    Kit: booleanOrNull(row['Kit']),
    ID_Tp_Warranty: numberOrNull(row['ID_Tp_Warranty']),
    Warranty_Reserve: numberOrNull(row['Warranty_Reserve']),
    Warranty_DT_Inicio: dateTimeOrNull(row['Warranty_DT_Inicio']),
    Orc_Proposta: stringOrNull(row['Orc_Proposta']),
    PO_Cliente: stringOrNull(row['PO_Cliente']),
    ID_Tp_Revenue: numberOrNull(row['ID_Tp_Revenue']),
    Provisoria: booleanOrNull(row['Provisoria']),
    Tp_Order_Label: stringOrNull(row['Tp_Order_Label']),
    Area_Label: stringOrNull(row['Area_Label']),
    Tipo_Label: stringOrNull(row['Tipo_Label']),
    Produto_Label: stringOrNull(row['Produto_Label']),
    Instrumento_Label: stringOrNull(row['Instrumento_Label']),
    Tp_Warranty_Label: stringOrNull(row['Tp_Warranty_Label']),
    Tp_Revenue_Label: stringOrNull(row['Tp_Revenue_Label']),
  }
}

export function toDetailRow(row: Record<string, unknown>): OrderDetailRow {
  return {
    ...toSummaryRow(row),
    Tipo_Warranty: booleanOrNull(row['Tipo_Warranty']),
    Orc_Proposta: stringOrNull(row['Orc_Proposta']),
    PO_Cliente: stringOrNull(row['PO_Cliente']),
    ID_Tp_Warranty: numberOrNull(row['ID_Tp_Warranty']),
    Warranty_Reserve: numberOrNull(row['Warranty_Reserve']),
    Warranty_DT_Inicio: dateTimeOrNull(row['Warranty_DT_Inicio']),
    ID_Tp_Revenue: numberOrNull(row['ID_Tp_Revenue']),
    Facturado: booleanOrNull(row['Facturado']),
    Reconhecido: booleanOrNull(row['Reconhecido']),
    Cod_Enc_Fornecedor: stringOrNull(row['Cod_Enc_Fornecedor']),
    Obs: stringOrNull(row['Obs']),
    ID_User: stringOrNull(row['ID_User']),
    DT_User: dateTimeOrNull(row['DT_User']),
    Kit: booleanOrNull(row['Kit']),
    Kit_Amount: numberOrNull(row['Kit_Amount']),
    Contacto: stringOrNull(row['Contacto']),
    Email: stringOrNull(row['Email']),
    Audit: stringOrNull(row['Audit']),
  }
}

export function toClientSummaryRow(row: Record<string, unknown>): ClientSummaryRow {
  return {
    ID_Cliente: numberOrThrow(row, 'ID_Cliente'),
    no_PHC: numberOrNull(row['no_PHC']),
    ID_Tp_Cliente: numberOrNull(row['ID_Tp_Cliente']),
    nome: stringOrNull(row['nome']),
    ncont: numberOrNull(row['ncont']),
    telefone: stringOrNull(row['telefone']),
    local: stringOrNull(row['local']),
  }
}

export function toClientDetailRow(row: Record<string, unknown>): ClientDetailRow {
  return {
    ...toClientSummaryRow(row),
    fax: stringOrNull(row['fax']),
    contacto: stringOrNull(row['contacto']),
    morada: stringOrNull(row['morada']),
    codpost: stringOrNull(row['codpost']),
    zona: stringOrNull(row['zona']),
    Defense: booleanOrNull(row['Defense']),
  }
}

export function toReconhecimentoRow(row: Record<string, unknown>): ReconhecimentoRow {
  return {
    ID_Reconhecimento: numberOrThrow(row, 'ID_Reconhecimento'),
    ID_Order: numberOrThrow(row, 'ID_Order'),
    ID_Tp_Reconhecimento: stringOrNull(row['ID_Tp_Reconhecimento']),
    DT_Reconhecimento: dateTimeOrNull(row['DT_Reconhecimento']),
    Valor_Reconhecimento: numberOrNull(row['Valor_Reconhecimento']),
    ID_User: stringOrNull(row['ID_User']),
    DT_User: dateTimeOrNull(row['DT_User']),
  }
}

export function toFacturacaoRow(row: Record<string, unknown>): DocumentoFaturacaoRow {
  return {
    ID_Facturacao: numberOrThrow(row, 'ID_Facturacao'),
    ID_Order: numberOrThrow(row, 'ID_Order'),
    DT_Doc_FT: dateTimeOrNull(row['DT_Doc_FT']),
    ID_Tp_Doc_FT: stringOrNull(row['ID_Tp_Doc_FT']),
    N_Doc_FT: stringOrNull(row['N_Doc_FT']),
    Valor_Doc_FT: numberOrNull(row['Valor_Doc_FT']),
    ID_User: stringOrNull(row['ID_User']),
    DT_User: dateTimeOrNull(row['DT_User']),
    Imprimiu: booleanOrNull(row['Imprimiu']),
    Imp_Block: booleanOrNull(row['Imp_Block']),
    Nome_PDF: stringOrNull(row['Nome_PDF']),
    E_Invoice: booleanOrNull(row['E_Invoice']),
  }
}

export function toKitConsumableRow(row: Record<string, unknown>): KitConsumableRow {
  return {
    ID_Kit: numberOrThrow(row, 'ID_Kit'),
    ID_Order: numberOrThrow(row, 'ID_Order'),
    Date: dateTimeOrNull(row['Date']),
    Internal_Order: stringOrNull(row['Internal_Order']),
    Material: stringOrNull(row['Material']),
    Description: stringOrNull(row['Description']),
    Quant: numberOrNull(row['Quant']),
    Unit_Price: numberOrNull(row['Unit_Price']),
    Total_Price: numberOrNull(row['Total_Price']),
  }
}
