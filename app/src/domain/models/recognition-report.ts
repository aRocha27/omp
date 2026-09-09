/**
 * Recognition report wire shape.
 *
 * Mirrors the server `RecognitionReportRow` in `server/src/types.ts` (one
 * degree of separation: this is the app-facing camelCase, the wire is the
 * same — the server normalises on the way out so the app never has to deal
 * with snake_case columns from the SQL view).
 */
export interface RecognitionReportRow {
  yearRecognition: number | null
  area: string | null
  grpReport: string | null
  tipo: string | null
  produto: string | null
  encomendaCliPHC: string | null
  cliente: string | null
  sellPrice: number | null
  tpReconhecimento: string | null
  january: number
  february: number
  march: number
  april: number
  may: number
  june: number
  july: number
  august: number
  september: number
  october: number
  november: number
  december: number
  totalYear: number
}

export interface RecognitionReportOptions {
  years: number[]
  areas: string[]
  grpReports: string[]
  tipos: string[]
  produtos: string[]
  encomendas: string[]
  tpReconhecimentos: string[]
}

/** A single facet option — id and label travel together so the UI can
 * render the canonical label without a second lookup. `null` ids/labels
 * preserve rows whose canonical value couldn't be derived (e.g.
 * `Year_Recognition = null` for future-dated recognitions). */
export interface RecognitionFacetOption {
  id: string | number | null
  label: string | null
}

/** Faceted response — every filterable dimension rendered as a DISTINCT
 * list of values that coexist with the rest of the active filters
 * (exclude-own-facet semantics). The same wire shape as the Orders facets
 * response so the UI can apply the same rendering rules. */
export interface RecognitionReportFacets {
  yearRecognition: RecognitionFacetOption[]
  area: RecognitionFacetOption[]
  grpReport: RecognitionFacetOption[]
  tipo: RecognitionFacetOption[]
  produto: RecognitionFacetOption[]
  encomendaCliPHC: RecognitionFacetOption[]
  tpReconhecimento: RecognitionFacetOption[]
}

/** Convenience alias used by the repository contract and the facets hook. */
export type RecognitionFacets = RecognitionReportFacets

/** All dimensions of the Recognition filter bar. Every dimension is
 * required because the page-side state always carries a complete
 * filter shape (`emptyRecognitionReportFilters()` / `defaultRecognitionReportFilters()`)
 * and the chip components need a defined `string[]` for their `selected`
 * prop. The wire contract to the backend accepts a `Partial<RecognitionReportFilters>`
 * (see `toRecognitionSearchFilters`) so partial shapes from `useQuery`
 * payloads still typecheck cleanly. */
export interface RecognitionReportFilters {
  yearRecognition: number[]
  area: string[]
  grpReport: string[]
  tipo: string[]
  produto: string[]
  encomendaCliPHC: string[]
  tpReconhecimento: string[]
}

/** Shape accepted by the backend's `recognitionReportFiltersSchema`
 * (Zod) — every dimension is optional there. Used internally by
 * `useRecognitionReportFacets` / the contract's `facets(filters)` so a
 * partial shape is still acceptable. */
export type PartialRecognitionReportFilters = Partial<RecognitionReportFilters>

/** Cleared-filter state. Every dimension explicitly carries an empty array
 * so the page never has to deal with `undefined` (each filter UI relies on
 * a defined array for its `selected` state). */
export const emptyRecognitionReportFilters: RecognitionReportFilters = {
  yearRecognition: [],
  area: [],
  grpReport: [],
  tipo: [],
  produto: [],
  encomendaCliPHC: [],
  tpReconhecimento: [],
}

export function defaultRecognitionReportFilters(today: Date = new Date()): RecognitionReportFilters {
  return {
    ...emptyRecognitionReportFilters,
    yearRecognition: [today.getUTCFullYear()],
  }
}

export function toRecognitionSearchFilters(
  value: RecognitionReportFilters,
): RecognitionReportFilters {
  // Today the wire shape mirrors the bar shape, so the conversion is a
  // structural clone. Kept as a helper so future whitespace trimming /
  // case-folding rules live in one place instead of being duplicated
  // across the bar / page / export callers.
  return {
    yearRecognition: [...value.yearRecognition],
    area: [...value.area],
    grpReport: [...value.grpReport],
    tipo: [...value.tipo],
    produto: [...value.produto],
    encomendaCliPHC: [...value.encomendaCliPHC],
    tpReconhecimento: [...value.tpReconhecimento],
  }
}
