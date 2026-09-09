import type {
  PartialRecognitionReportFilters,
  RecognitionReportFacets,
  RecognitionReportFilters,
  RecognitionReportOptions,
  RecognitionReportRow,
} from '@/domain/models/recognition-report'
import { RepositoryError } from './orders.repository'

/**
 * Recognition report repository contract.
 *
 * Backed in `api` mode by `POST /api/recognition/list`,
 * `POST /api/recognition/facets`, and the legacy
 * `GET /api/recognition/filter-options`. The mock implementation returns a
 * deterministic, fixture-driven dataset so the page works in dev / CI
 * without a live database. The list endpoint accepts the full filter
 * shape; the facets endpoint returns every dimension narrowed by the
 * active filters (exclude-own-facet contract).
 */
export interface RecognitionReportRepository {
  list(
    filters: RecognitionReportFilters,
    limit: number,
  ): Promise<RecognitionReportRow[]>
  /**
   * Distinct option set per dimension, narrowed by `filters` (exclude-own-facet).
   * The shape is `RecognitionReportFacets` — canonical id+label per option,
   * with the same UI contract as the Orders facets. Accepts a partial
   * filter object (e.g. `{ tipo: ['CM'] }`) or the empty `{}` to fetch the
   * universe of options.
   */
  facets(
    filters: PartialRecognitionReportFilters,
  ): Promise<RecognitionReportFacets>
  /** Legacy helper kept for the existing GET endpoint. New callers should
   * prefer `facets(filters)` so the universe narrows with the active filters. */
  getFilterOptions(): Promise<RecognitionReportOptions>
}

export { RepositoryError }