/**
 * Reference cascade query-param schemas and Recognition-report filter schemas.
 *
 * The cascade query params (`area`, `produto`) are used by
 * `/api/areas`, `/api/produtos`, and `/api/instrumentos` to narrow the
 * returned list by parent id.
 */
import { z } from 'zod'

// Sub-table reads take the order id as a query parameter (?orderId=N). Positive integer.
// Mirrors orderIdParamSchema but bound to the `orderId` query key.
export const orderIdQueryParamSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined ? undefined : Number(value)))
  .pipe(z.number().int().positive())

export type OrderIdQueryParam = z.infer<typeof orderIdQueryParamSchema>

// Reference cascade query params. `area` is a non-empty string code (dbo.Area.ID_Area); an
// absent `area` means "all products". `produto` is a positive integer (dbo.Produto.ID_Produto);
// an absent `produto` means "all instruments". Both are optional so the same endpoints serve the
// non-cascaded filters (which list every row) and the cascaded create/detail dropdowns.
export const areaQueryParamSchema = z.string().trim().min(1).optional()

export const produtoQueryParamSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined ? undefined : Number(value)))
  .pipe(z.number().int().positive().optional())

// Recognition report filters. The list endpoint accepts any subset; an empty
// `filters` object returns every row the view produces (subject to the `limit`).
export const recognitionReportFiltersSchema = z.object({
  yearRecognition: z.array(z.number().int()).optional(),
  area: z.array(z.string().trim().min(1)).optional(),
  grpReport: z.array(z.string().trim().min(1)).optional(),
  tipo: z.array(z.string().trim().min(1)).optional(),
  produto: z.array(z.string().trim().min(1)).optional(),
  encomendaCliPHC: z.array(z.string().trim().min(1)).optional(),
  tpReconhecimento: z.array(z.string().trim().min(1)).optional(),
})

export const recognitionReportListBodySchema = z.object({
  filters: recognitionReportFiltersSchema.optional().default({}),
  limit: z.number().int().min(1).max(10000).optional(),
})

export type RecognitionReportListBody = z.infer<typeof recognitionReportListBodySchema>

/** Faceted filter endpoint — accepts the same filters as the list endpoint
 * and returns the DISTINCT option set per dimension, narrowed by the
 * exclude-own-facet contract (section 3 of the brief). */
export const recognitionFacetsBodySchema = z.object({
  filters: recognitionReportFiltersSchema.optional().default({}),
})

export type RecognitionFacetsBody = z.infer<typeof recognitionFacetsBodySchema>