/**
 * Recognition report wire types (crosstab view
 * `dbo.V_Reconhecimento_Monthly_Crosstab`).
 *
 * Dimensions:
 *  - `Year_Recognition` is nullable in the source view: rows whose year
 *    couldn't be derived from the recognition date still appear, with NULL.
 *  - `Cliente` is the raw client name from the view, used as display text.
 *
 * Measures:
 *  - `Sell_Price` (one column, year-agnostic): the order sell price.
 *  - The 12 monthly values are decimal numbers (may be 0 for a month with no
 *    recognition posting on that row).
 *  - `Total_Year` matches the sum of the 12 month columns for the same row
 *    (the view's own column — kept verbatim so the spreadsheet matches the
 *    server-rendered numbers exactly).
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
 * (exclude-own-facet semantics). */
export interface RecognitionReportFacets {
  yearRecognition: RecognitionFacetOption[]
  area: RecognitionFacetOption[]
  grpReport: RecognitionFacetOption[]
  tipo: RecognitionFacetOption[]
  produto: RecognitionFacetOption[]
  encomendaCliPHC: RecognitionFacetOption[]
  tpReconhecimento: RecognitionFacetOption[]
}

export type OkRecognitionReport = {
  ok: true
  rows: RecognitionReportRow[]
}

export type OkRecognitionReportOptions = {
  ok: true
  options: RecognitionReportOptions
}

export type OkRecognitionReportFacets = {
  ok: true
  facets: RecognitionReportFacets
}