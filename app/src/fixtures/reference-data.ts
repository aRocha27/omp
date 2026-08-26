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

import type {
  AreaOption,
  InstrumentoOption,
  ProdutoOption,
} from '@/domain/models/reference-cascade'

export type { AreaOption, InstrumentoOption, ProdutoOption }

export interface ReferenceOption {
  id: string | number
  label: string
}

/**
 * Order kind option, extended with the `dbo.Tipo.Warranty` bit (harvested from
 * BRKR_ERP). `warranty=true` kinds (INSTR/ACESS/WARR) carry a warranty reserve
 * and expose the warranty caracterização fields + the propagate-garantia button;
 * the rest (CM/CONS/SERVI/SPARE/TR) do not. The live detail endpoint resolves
 * this same bit server-side into `Order.Tipo_Warranty`; the mock derives it here
 * from `ID_Tipo` (see `resolveTipoWarranty`).
 */
export interface TipoOption extends ReferenceOption {
  warranty: boolean
}

/** Order type code (`Order.ID_Tp_Order`, string). Harvested from dbo.Tp_Order. */
export const orderTypes: readonly ReferenceOption[] = [
  { id: 'C', label: 'Client' },
  { id: 'S', label: 'Stock' },
  { id: 'W', label: 'Warranty' },
  { id: 'WPO', label: 'Waiting PO Customer' },
  { id: 'COM', label: 'Comercial' },
  { id: 'CANC', label: 'CANCELLED' },
  { id: 'CFA', label: 'Client FactoryDirect' },
  { id: 'SAP', label: 'Introduzir SAP' },
  { id: 'SAPST', label: 'SAP Stock' },
]

/** Business area (`Order.ID_Area`, string code). */
export const areas: readonly AreaOption[] = [
  { id: 'BDAL', label: 'BDAL' },
  { id: 'BOPT', label: 'BOPT' },
]

/** Order kind (`Order.ID_Tipo`, string code). `warranty` mirrors `dbo.Tipo.Warranty`. */
export const tipos: readonly TipoOption[] = [
  { id: 'INSTR', label: 'INSTRUMENT', warranty: true },
  { id: 'ACESS', label: 'ACESSORIES', warranty: true },
  { id: 'CM', label: 'MAINTENANCE CONTRACT', warranty: false },
  { id: 'CONS', label: 'CONSUMABLES', warranty: false },
  { id: 'SERVI', label: 'SERVICE', warranty: false },
  { id: 'SPARE', label: 'SPARE-PARTS', warranty: false },
  { id: 'TR', label: 'TRAINING', warranty: false },
  { id: 'WARR', label: 'WARRANTY RESERVE', warranty: true },
]

/**
 * Resolve the `Tipo.Warranty` bit for an order kind code, mirroring the live
 * `dbo.Tipo` join. Returns `null` for an unknown/null code so the UI treats an
 * unresolved kind as "no warranty" rather than asserting a default.
 */
export function resolveTipoWarranty(idTipo: string | null | undefined): boolean | null {
  if (idTipo === null || idTipo === undefined) return null
  const match = tipos.find((o) => String(o.id) === String(idTipo))
  return match ? match.warranty : null
}

/**
 * Product (`Order.ID_Produto`, number). `area` mirrors `dbo.Produto.ID_Area` so the
 * cascade dropdown can filter produtos by the selected área (BDAL/BOPT). Verified
 * 2026-08-25 against BRKR_ERP: 1,2,3,12,13→BOPT; 5,6,7,8,9,10,11→BDAL.
 */
export const produtos: readonly ProdutoOption[] = [
  { id: 1, label: 'MIR', area: 'BOPT' },
  { id: 2, label: 'NIR', area: 'BOPT' },
  { id: 3, label: 'Raman', area: 'BOPT' },
  { id: 5, label: 'LAB GC / SQ-MS Service', area: 'BDAL' },
  { id: 6, label: 'GC-MS / LC-MS', area: 'BDAL' },
  { id: 7, label: 'ESI Ion Trap', area: 'BDAL' },
  { id: 8, label: 'ESI TOF', area: 'BDAL' },
  { id: 9, label: 'FTMS', area: 'BDAL' },
  { id: 10, label: 'Maldi-TOF', area: 'BDAL' },
  { id: 11, label: 'MALDI BT', area: 'BDAL' },
  { id: 12, label: 'RS', area: 'BOPT' },
  { id: 13, label: 'CML', area: 'BOPT' },
]

/**
 * Instrument (`Order.ID_Instrumento`, number). `produto` mirrors
 * `dbo.Instrumento.ID_Produto` so the cascade dropdown can filter instrumentos by
 * the selected produto. Verified 2026-08-25 against BRKR_ERP (id→ID_Produto).
 * The fixture holds the subset with labels harvested for label resolution/filter
 * dropdowns; the live `/api/instrumentos` endpoint returns the full 91-row set.
 */
export const instrumentos: readonly InstrumentoOption[] = [
  { id: 1, label: 'VERTEX 70', produto: 1 },
  { id: 2, label: 'LCMS', produto: 6 },
  { id: 4, label: 'GC 43X', produto: 5 },
  { id: 5, label: 'UltrafleXtreme', produto: 10 },
  { id: 7, label: 'Sampler GC', produto: 6 },
  { id: 8, label: 'Impact II', produto: 8 },
  { id: 10, label: 'TENSOR 27', produto: 13 },
  { id: 11, label: 'MPA', produto: 2 },
  { id: 12, label: 'SCION TQ/456 GC', produto: 6 },
  { id: 13, label: 'TANGO R', produto: 2 },
  { id: 15, label: 'ALPHA', produto: 13 },
  { id: 16, label: 'AutoFlex TOF/TOF', produto: 10 },
  { id: 17, label: 'SCION TQ/436 GC', produto: 6 },
  { id: 18, label: 'Hyperion', produto: 1 },
  { id: 19, label: 'Matrix-F/MF', produto: 2 },
  { id: 20, label: 'IFS125 HR/M', produto: 1 },
  { id: 21, label: 'FTMS 7', produto: 9 },
  { id: 22, label: 'Esquire', produto: 7 },
  { id: 23, label: 'MALDI Biotyper (Rental)', produto: 11 },
  { id: 24, label: 'Vector 22', produto: 13 },
  { id: 25, label: 'ATR', produto: 13 },
  { id: 26, label: 'MultiRAM', produto: 3 },
  { id: 27, label: 'TQMS', produto: 6 },
  { id: 28, label: 'Equinox 55', produto: 1 },
  { id: 29, label: 'SCION SQ/456 GC', produto: 5 },
  { id: 30, label: 'maXis impact', produto: 8 },
  { id: 31, label: 'SCION SQ/436 GC', produto: 5 },
  { id: 32, label: 'GC 45X', produto: 5 },
  { id: 34, label: 'Vector 22N', produto: 2 },
  { id: 35, label: 'Impact HD', produto: 8 },
  { id: 36, label: 'EM27', produto: 12 },
  { id: 57, label: 'SIGIS', produto: 12 },
  { id: 70, label: 'MALDI Biotyper (Straight Sale)', produto: 11 },
]

/** Warranty type (`Order.ID_Tp_Warranty`, number). */
export const warrantyTypes: readonly ReferenceOption[] = [
  { id: 1, label: '1 Year' },
  { id: 2, label: '2 Years' },
  { id: 3, label: '3 Years' },
]

/** Revenue type (`Order.ID_Tp_Revenue`, number). */
export const revenueTypes: readonly ReferenceOption[] = [
  { id: 1, label: 'System Sales & Materials Revenue' },
  { id: 2, label: 'Accessories Revenue' },
  { id: 3, label: 'Service Revenue' },
]

/** Revenue recognition type (`Reconhecimento.ID_Tp_Reconhecimento`, string). Harvested from dbo.Tp_Reconhecimento. */
export const tpReconhecimentos: readonly ReferenceOption[] = [
  { id: 'CM', label: 'Maintenance Contract' },
  { id: 'P', label: 'Partial' },
  { id: 'T', label: 'Total' },
  { id: 'W', label: 'Warranty' },
  { id: 'WP', label: 'Warranty Partial' },
]

/** Warranty type codes (W/WP) — used to split recognition totals into Instrument vs Warranty. */
export const WARRANTY_RECONHECIMENTO_CODES: readonly string[] = ['W', 'WP']

/** Invoicing document type (`Facturacao.ID_Tp_Doc_FT`, string). Harvested from dbo.Tp_Doc_FT. */
export const tpDocFts: readonly ReferenceOption[] = [
  { id: 'AcFT', label: 'Invoice Adjustment' },
  { id: 'FT', label: 'Invoice' },
  { id: 'NC', label: 'Credit Note' },
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