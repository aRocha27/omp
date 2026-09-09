/**
 * Reference-data fixtures for order filter dropdowns and label resolution.
 *
 * These {id, label} pairs back both the filter `<select>` options and the
 * ID→label resolvers in `reference-labels.ts`. They are demo data shaped to
 * exercise every branch of the resolvers and do not represent any real
 * customer's reference tables.
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
 * Order kind option, extended with a `warranty` bit. `warranty=true` kinds
 * (INSTR/ACESS/WARR) carry a warranty reserve and expose the warranty
 * caracterização fields + the propagate-garantia button; the rest
 * (CM/CONS/SERVI/SPARE/TR) do not. The live detail endpoint resolves this
 * same bit server-side into `Order.Tipo_Warranty`; the mock derives it here
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

/** Business area (`Order.ID_Area`, string code). The `label` is the live `dbo.Area.Area`
 *  text (e.g. `ZJ-BLSMS`) so the order table always shows the canonical name. Codes
 *  missing here remain unresolved in the UI; live Orders labels come from the API. */
export const areas: readonly AreaOption[] = [
  { id: 'BAMS', label: 'ZP-BAMS' },
  { id: 'BDAL', label: 'ZJ-BLSMS' },
  { id: 'BMID', label: 'ZQ-BMID' },
  { id: 'BOPT', label: 'ZI-BOPT' },
]

/** Order kind (`Order.ID_Tipo`, string code). `warranty` mirrors `dbo.Tipo.Warranty`. */
export const tipos: readonly TipoOption[] = [
  { id: 'INSTR', label: 'INSTRUMENT', warranty: true },
  { id: 'ACESS', label: 'ACESSORIES', warranty: true },
  { id: 'CM', label: 'MAINTENANCE CONTRACT', warranty: false },
  { id: 'CONS', label: 'CONSUMABLES', warranty: false },
  { id: 'SERVI', label: 'SERVICE', warranty: false },
  { id: 'SOFT', label: 'SOFTWARE', warranty: false },
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
 * Product (`Order.ID_Produto`, number). `area` mirrors a logical product area so
 * the cascade dropdown can filter produtos by the selected área. `label` is a
 * demo-friendly short name; live Orders labels come from the API view.
 */
export const produtos: readonly ProdutoOption[] = [
  { id: 1, label: 'MIR', area: 'BOPT' },
  { id: 2, label: 'NIR', area: 'BOPT' },
  { id: 3, label: 'Raman', area: 'BOPT' },
  { id: 5, label: 'BDAL LAB GC / SQ-MS Service', area: 'BDAL' },
  { id: 6, label: 'BDAL GC-MS / LC-MS', area: 'BDAL' },
  { id: 7, label: 'BDAL ESI Ion Trap', area: 'BDAL' },
  { id: 8, label: 'BDAL OTOF', area: 'BDAL' },
  { id: 9, label: 'BDAL MRMS', area: 'BDAL' },
  { id: 10, label: 'BDAL MALDI TOF', area: 'BDAL' },
  { id: 11, label: 'MALDI BT', area: 'BDAL' },
  { id: 12, label: 'RS', area: 'BOPT' },
  { id: 13, label: 'CML', area: 'BOPT' },
  { id: 14, label: 'BBS SPR', area: 'BDAL' },
  { id: 15, label: 'Molecular', area: 'BDAL' },
  { id: 16, label: 'CBRN', area: 'BOPT' },
  { id: 17, label: 'Explosives', area: 'BOPT' },
  { id: 18, label: 'BGS GRP-PREOMICS', area: 'BDAL' },
  { id: 19, label: 'BDAL LSMS TIMS TOF', area: 'BDAL' },
  { id: 20, label: 'BGS GRP-BIOGNOSYS', area: 'BDAL' },
  { id: 21, label: 'AMS ESI IONTRAP', area: 'BAMS' },
  { id: 22, label: 'AMS LAB GCMS/LCMS', area: 'BAMS' },
  { id: 23, label: 'AMS GCMS/LCMS', area: 'BAMS' },
  { id: 24, label: 'AMS MRMS', area: 'BAMS' },
  { id: 25, label: 'AMS AXIAL TOF', area: 'BAMS' },
  { id: 26, label: 'AMS TIMS TOF', area: 'BAMS' },
  { id: 27, label: 'AMS OTOF', area: 'BAMS' },
  { id: 28, label: 'MID MALDIBIOTYPER', area: 'BMID' },
  { id: 29, label: 'MID Molecular', area: 'BMID' },
  { id: 30, label: 'BDAL TOFWERK', area: 'BDAL' },
  { id: 31, label: 'BGS GRP-MS Consumables', area: 'BDAL' },
  { id: 32, label: 'BDAL RECIPE', area: 'BDAL' },
  { id: 33, label: 'BDAL TIMSTOF CH', area: 'BDAL' },
  { id: 34, label: 'BGS GRP-Biocrates', area: 'BDAL' },
  { id: 35, label: 'BBS-DBS', area: 'BDAL' },
]

/**
 * Instrument (`Order.ID_Instrumento`, number). `produto` mirrors a logical
 * product so the cascade dropdown can filter instrumentos by the selected
 * produto. The fixture holds the subset used for label resolution and filter
 * dropdowns; the live `/api/instrumentos` endpoint returns the full set.
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

/** Warranty type (`Order.ID_Tp_Warranty`, number). Live codes 1–5 come from
 *  `dbo.Tp_Warranty` (`1 Ano`, `2 Anos`, …). The UI label is the live Portuguese text. */
export const warrantyTypes: readonly ReferenceOption[] = [
  { id: 1, label: '1 Ano' },
  { id: 2, label: '2 Anos' },
  { id: 3, label: '3 Anos' },
  { id: 4, label: '4 Anos' },
  { id: 5, label: '5 Anos' },
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
