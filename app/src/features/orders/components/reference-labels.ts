/**
 * Resolve order foreign-key IDs / type codes to human-readable labels.
 *
 * The reference-data fixtures are synthetic UNVERIFIED placeholders (AGENT.md
 * §7, §21; the HTML prototype is a UI reference only). Swapping these fixture
 * imports for confirmed DB-backed reference data is the ONLY change needed to
 * make labels production-accurate — every call site stays the same.
 *
 * Returning `null` (rendered as "—" by the UI) keeps each field's slot in place,
 * so a raw ID can be reintroduced later without restructuring the layout. This
 * is the single seam where "show the ID again" would be wired in.
 */
import { areas, instrumentos, orderTypes, produtos, type ReferenceOption } from '@/fixtures/reference-data'

function labelFor(
  options: readonly ReferenceOption[],
  id: string | number | null | undefined,
): string | null {
  if (id === null || id === undefined) return null
  const match = options.find((o) => String(o.id) === String(id))
  return match ? match.label : null
}

/** Business area (`Order.ID_Area`). */
export const areaLabel = (id: number | null | undefined): string | null => labelFor(areas, id)

/** Product (`Order.ID_Produto`). */
export const produtoLabel = (id: number | null | undefined): string | null => labelFor(produtos, id)

/** Instrument (`Order.ID_Instrumento`). */
export const instrumentoLabel = (id: number | null | undefined): string | null =>
  labelFor(instrumentos, id)

/** Order type code (`Order.ID_Tp_Order`). */
export const orderTypeLabel = (code: string | null | undefined): string | null =>
  labelFor(orderTypes, code)