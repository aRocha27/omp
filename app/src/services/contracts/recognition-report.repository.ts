import type {
  RecognitionReportFilters,
  RecognitionReportOptions,
  RecognitionReportRow,
} from '@/domain/models/recognition-report'
import { RepositoryError } from './orders.repository'

/**
 * Recognition report repository contract.
 *
 * Backed in `api` mode by `POST /api/recognition/list` and
 * `GET /api/recognition/filter-options`. The mock implementation returns a
 * deterministic, fixture-driven dataset so the page works in dev / CI
 * without a live database. The list endpoint accepts the full filter
 * shape; the options endpoint returns the universe of valid values for
 * every filterable dimension.
 */
export interface RecognitionReportRepository {
  list(
    filters: RecognitionReportFilters,
    limit: number,
  ): Promise<RecognitionReportRow[]>
  getFilterOptions(): Promise<RecognitionReportOptions>
}

export { RepositoryError }
