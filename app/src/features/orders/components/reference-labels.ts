/**
 * Resolve order foreign-key IDs / type codes to human-readable labels.
 *
 * Backed by the reference data in `@/fixtures/reference-data`. Swapping those
 * fixture imports for a live reference-data endpoint is the ONLY change needed
 * to refresh labels — every call site stays the same.
 *
 * Returning `null` for an unresolved non-NULL ID makes a mapping/data-integrity problem
 * visible as an empty slot instead of presenting an internal ID as business data.
 */
import {
  areas,
  instrumentos,
  orderTypes,
  produtos,
  revenueTypes,
  tipos,
  tpClientes,
  tpDocFts,
  tpReconhecimentos,
  warrantyTypes,
  type ReferenceOption,
} from '@/fixtures/reference-data'

export function displayLabel(
  options: readonly ReferenceOption[],
  id: string | number | null | undefined,
): string | null {
  if (id === null || id === undefined) return null
  const match = options.find((o) => String(o.id) === String(id))
  return match ? match.label : null
}

/** Business area (`Order.ID_Area`, string code). */
export const areaLabel = (id: string | null | undefined): string | null => displayLabel(areas, id)

/** Order kind (`Order.ID_Tipo`, string code). */
export const tipoLabel = (id: string | null | undefined): string | null => displayLabel(tipos, id)

/** Product (`Order.ID_Produto`). */
export const produtoLabel = (id: number | null | undefined): string | null =>
  displayLabel(produtos, id)

/** Instrument (`Order.ID_Instrumento`). */
export const instrumentoLabel = (id: number | null | undefined): string | null =>
  displayLabel(instrumentos, id)

/** Order type code (`Order.ID_Tp_Order`). */
export const orderTypeLabel = (code: string | null | undefined): string | null =>
  displayLabel(orderTypes, code)

/** Warranty type (`Order.ID_Tp_Warranty`, numeric code). */
export const warrantyLabel = (id: number | null | undefined): string | null =>
  displayLabel(warrantyTypes, id)

/** Revenue type (`Order.ID_Tp_Revenue`, numeric code). */
export const revenueLabel = (id: number | null | undefined): string | null =>
  displayLabel(revenueTypes, id)

/** Recognition type (`Reconhecimento.ID_Tp_Reconhecimento`, string code). */
export const reconhecimentoLabel = (id: string | null | undefined): string | null =>
  displayLabel(tpReconhecimentos, id)

/** Invoicing document type (`Facturacao.ID_Tp_Doc_FT`, string code). */
export const docFtLabel = (id: string | null | undefined): string | null =>
  displayLabel(tpDocFts, id)

/** Client type (`Client.ID_Tp_Cliente`, numeric code). */
export const tpClienteLabel = (id: number | null | undefined): string | null =>
  displayLabel(tpClientes, id)
