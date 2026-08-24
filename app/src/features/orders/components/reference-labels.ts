/**
 * Resolve order foreign-key IDs / type codes to human-readable labels.
 *
 * Backed by the verified BRKR_ERP reference data in `@/fixtures/reference-data`
 * (harvested 2026-08-23). Swapping those fixture imports for a live reference-data
 * endpoint is the ONLY change needed to refresh labels — every call site stays the
 * same.
 *
 * Returning `null` (rendered as "—" by the UI) keeps each field's slot in place, so a
 * raw ID can be reintroduced later without restructuring the layout. This is the single
 * seam where "show the ID again" would be wired in.
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

function labelFor(
  options: readonly ReferenceOption[],
  id: string | number | null | undefined,
): string | null {
  if (id === null || id === undefined) return null
  const match = options.find((o) => String(o.id) === String(id))
  return match ? match.label : null
}

/** Business area (`Order.ID_Area`, string code). */
export const areaLabel = (id: string | null | undefined): string | null => labelFor(areas, id)

/** Order kind (`Order.ID_Tipo`, string code). */
export const tipoLabel = (id: string | null | undefined): string | null => labelFor(tipos, id)

/** Product (`Order.ID_Produto`). */
export const produtoLabel = (id: number | null | undefined): string | null => labelFor(produtos, id)

/** Instrument (`Order.ID_Instrumento`). */
export const instrumentoLabel = (id: number | null | undefined): string | null =>
  labelFor(instrumentos, id)

/** Order type code (`Order.ID_Tp_Order`). */
export const orderTypeLabel = (code: string | null | undefined): string | null =>
  labelFor(orderTypes, code)

/** Warranty type (`Order.ID_Tp_Warranty`, numeric code). */
export const warrantyLabel = (id: number | null | undefined): string | null =>
  labelFor(warrantyTypes, id)

/** Revenue type (`Order.ID_Tp_Revenue`, numeric code). */
export const revenueLabel = (id: number | null | undefined): string | null =>
  labelFor(revenueTypes, id)

/** Recognition type (`Reconhecimento.ID_Tp_Reconhecimento`, string code). */
export const reconhecimentoLabel = (id: string | null | undefined): string | null =>
  labelFor(tpReconhecimentos, id)

/** Invoicing document type (`Facturacao.ID_Tp_Doc_FT`, string code). */
export const docFtLabel = (id: string | null | undefined): string | null =>
  labelFor(tpDocFts, id)

/** Client type (`Client.ID_Tp_Cliente`, numeric code). */
export const tpClienteLabel = (id: number | null | undefined): string | null =>
  labelFor(tpClientes, id)