/**
 * Reference-data fixtures for order filter dropdowns and label resolution.
 *
 * Verified 2026-08-23 against BRKR_ERP (dbo). These {id, label} pairs are the real
 * distinct values harvested from the live database — they back both the filter
 * `<select>` options and the ID→label resolvers in `reference-labels.ts`.
 *
 * Regeneration: if the DB codes change, re-run a `SELECT DISTINCT` against the live
 * tables/view and paste the results here (an optional harvest script is a follow-up;
 * the data is baked in for now).
 */

export interface ReferenceOption {
  id: string | number
  label: string
}

/** Order type code (`Order.ID_Tp_Order`, string). Harvested from dbo.Tp_Order. */
export const orderTypes: readonly ReferenceOption[] = [
  { id: 'C', label: 'Client' },
  { id: 'S', label: 'Stock' },
  { id: 'W', label: 'Warranty' },
  { id: 'WPO', label: 'Waiting PO Customer' },
  { id: 'COM', label: 'Comercial' },
  { id: 'CANC', label: 'ANULADO' },
  { id: 'CFA', label: 'Client FactoryDirect' },
  { id: 'SAP', label: 'Introduzir SAP' },
  { id: 'SAPST', label: 'SAP Stock' },
]

/** Business area (`Order.ID_Area`, string code). */
export const areas: readonly ReferenceOption[] = [
  { id: 'BDAL', label: 'BDAL' },
  { id: 'BOPT', label: 'BOPT' },
]

/** Order kind (`Order.ID_Tipo`, string code). */
export const tipos: readonly ReferenceOption[] = [
  { id: 'INSTR', label: 'INSTRUMENT' },
  { id: 'ACESS', label: 'ACESSORIES' },
  { id: 'CM', label: 'MAINTENANCE CONTRACT' },
  { id: 'CONS', label: 'CONSUMABLES' },
  { id: 'SERVI', label: 'SERVICE' },
  { id: 'SPARE', label: 'SPARE-PARTS' },
  { id: 'TR', label: 'TRAINING' },
  { id: 'WARR', label: 'WARRANTY RESERVE' },
]

/** Product (`Order.ID_Produto`, number). */
export const produtos: readonly ReferenceOption[] = [
  { id: 1, label: 'MIR' },
  { id: 2, label: 'NIR' },
  { id: 3, label: 'Raman' },
  { id: 5, label: 'LAB GC / SQ-MS Service' },
  { id: 6, label: 'GC-MS / LC-MS' },
  { id: 7, label: 'ESI Ion Trap' },
  { id: 8, label: 'ESI TOF' },
  { id: 9, label: 'FTMS' },
  { id: 10, label: 'Maldi-TOF' },
  { id: 11, label: 'MALDI BT' },
  { id: 12, label: 'RS' },
  { id: 13, label: 'CML' },
]

/** Instrument (`Order.ID_Instrumento`, number). */
export const instrumentos: readonly ReferenceOption[] = [
  { id: 1, label: 'VERTEX 70' },
  { id: 2, label: 'LCMS' },
  { id: 4, label: 'GC 43X' },
  { id: 5, label: 'UltrafleXtreme' },
  { id: 7, label: 'Sampler GC' },
  { id: 8, label: 'Impact II' },
  { id: 10, label: 'TENSOR 27' },
  { id: 11, label: 'MPA' },
  { id: 12, label: 'SCION TQ/456 GC' },
  { id: 13, label: 'TANGO R' },
  { id: 15, label: 'ALPHA' },
  { id: 16, label: 'AutoFlex TOF/TOF' },
  { id: 17, label: 'SCION TQ/436 GC' },
  { id: 18, label: 'Hyperion' },
  { id: 19, label: 'Matrix-F/MF' },
  { id: 20, label: 'IFS125 HR/M' },
  { id: 21, label: 'FTMS 7' },
  { id: 22, label: 'Esquire' },
  { id: 23, label: 'MALDI Biotyper (Rental)' },
  { id: 24, label: 'Vector 22' },
  { id: 25, label: 'ATR' },
  { id: 26, label: 'MultiRAM' },
  { id: 27, label: 'TQMS' },
  { id: 28, label: 'Equinox 55' },
  { id: 29, label: 'SCION SQ/456 GC' },
  { id: 30, label: 'maXis impact' },
  { id: 31, label: 'SCION SQ/436 GC' },
  { id: 32, label: 'GC 45X' },
  { id: 34, label: 'Vector 22N' },
  { id: 35, label: 'Impact HD' },
  { id: 36, label: 'EM27' },
  { id: 57, label: 'SIGIS' },
  { id: 70, label: 'MALDI Biotyper (Straight Sale)' },
]

/** Warranty type (`Order.ID_Tp_Warranty`, number). */
export const warrantyTypes: readonly ReferenceOption[] = [
  { id: 1, label: '1 Ano' },
  { id: 2, label: '2 Anos' },
  { id: 3, label: '3 Anos' },
]

/** Revenue type (`Order.ID_Tp_Revenue`, number). */
export const revenueTypes: readonly ReferenceOption[] = [
  { id: 1, label: 'System Sales & Materials Revenue' },
  { id: 2, label: 'Accessories Revenue' },
  { id: 3, label: 'Service Revenue' },
]

/** Revenue recognition type (`Reconhecimento.ID_Tp_Reconhecimento`, string). Harvested from dbo.Tp_Reconhecimento. */
export const tpReconhecimentos: readonly ReferenceOption[] = [
  { id: 'CM', label: 'C Manut' },
  { id: 'P', label: 'Parcial' },
  { id: 'T', label: 'Total' },
  { id: 'W', label: 'Warranty' },
  { id: 'WP', label: 'Warranty Parcial' },
]

/** Warranty type codes (W/WP) — used to split recognition totals into Instrument vs Warranty. */
export const WARRANTY_RECONHECIMENTO_CODES: readonly string[] = ['W', 'WP']

/** Invoicing document type (`Facturacao.ID_Tp_Doc_FT`, string). Harvested from dbo.Tp_Doc_FT. */
export const tpDocFts: readonly ReferenceOption[] = [
  { id: 'AcFT', label: 'Acerto Factura' },
  { id: 'FT', label: 'Factura' },
  { id: 'NC', label: 'Nota Crédito' },
]

/** Client type (`Client.ID_Tp_Cliente`, number). Harvested from dbo.Tp_Cliente. */
export const tpClientes: readonly ReferenceOption[] = [
  { id: 1, label: 'Academia & Non-Profit' },
  { id: 2, label: 'Applied Markets' },
  { id: 3, label: 'Government (Federal, State & Local)' },
  { id: 4, label: 'Healthcare Companies for Research' },
  { id: 5, label: 'Industrial QA/QC' },
  { id: 6, label: 'Industrial Research' },
]