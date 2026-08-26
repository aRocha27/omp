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
}

export interface RecognitionReportFilters {
  yearRecognition: number[]
  area: string[]
  grpReport: string[]
  tipo: string[]
  produto: string[]
  encomendaCliPHC: string[]
}

export const emptyRecognitionReportFilters: RecognitionReportFilters = {
  yearRecognition: [],
  area: [],
  grpReport: [],
  tipo: [],
  produto: [],
  encomendaCliPHC: [],
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
  }
}
