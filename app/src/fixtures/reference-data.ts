/**
 * Synthetic reference-data fixtures for order filter dropdowns.
 *
 * MOCK DATA ONLY — never production facts (docs/context/MOCK_DATA_CONTRACT.md).
 * These {id, label} entries exist purely so the filter `<select>`s have options
 * that match the synthetic IDs in `orders.ts`. The labels borrow readable names
 * from the HTML MVP prototype for demo convenience, but they are NOT confirmed
 * reference data — the real Area / Produto / Instrumento / Tp_Order values and
 * labels come from the database during the integration phase (AGENT.md §7, §21;
 * the HTML prototype is a UI reference only, not a data source).
 *
 * Option IDs are kept in sync with the distinct values present in `orders.ts`
 * so filtering against the mock repository returns sensible results.
 */

export interface ReferenceOption {
  id: string | number
  label: string
}

/** Order type codes (maps to `Order.ID_Tp_Order`). */
export const orderTypes: readonly ReferenceOption[] = [
  { id: 'STD', label: 'Standard' },
  { id: 'FAB', label: 'Factory' },
]

/** Business area (maps to `Order.ID_Area`). */
export const areas: readonly ReferenceOption[] = [
  { id: 1, label: 'Service' },
  { id: 2, label: 'Systems' },
]

/** Product (maps to `Order.ID_Produto`). */
export const produtos: readonly ReferenceOption[] = [
  { id: 10, label: 'NMR' },
  { id: 11, label: 'XRF' },
  { id: 12, label: 'MS' },
  { id: 13, label: 'Other' },
]

/** Instrument (maps to `Order.ID_Instrumento`). */
export const instrumentos: readonly ReferenceOption[] = [
  { id: 200, label: 'Alpha II' },
  { id: 201, label: 'Avance' },
  { id: 202, label: 'Impact' },
  { id: 203, label: 'Other' },
]