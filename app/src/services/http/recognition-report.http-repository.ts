import type { RecognitionReportRepository } from '@/services/contracts/recognition-report.repository'
import type {
  PartialRecognitionReportFilters,
  RecognitionReportFacets,
  RecognitionReportFilters,
  RecognitionReportOptions,
  RecognitionReportRow,
} from '@/domain/models/recognition-report'
import {
  getJsonReadOnly,
  postJsonReadOnly,
  toRepositoryErrorReadOnly,
  type ApiFailure,
} from '@/services/http/_shared'

interface OkRowsResponse {
  ok: true
  rows: RecognitionReportRow[]
}

interface OkFacetsResponse {
  ok: true
  facets: RecognitionReportFacets
}

interface OkOptionsResponse {
  ok: true
  options: RecognitionReportOptions
}

const RECOGNITION_REPORT_FORBIDDEN_CODES = new Set(['forbidden', 'UNAUTHORIZED'])

export class HttpRecognitionReportRepository implements RecognitionReportRepository {
  async list(
    filters: RecognitionReportFilters,
    limit: number,
  ): Promise<RecognitionReportRow[]> {
    const body = { filters, limit }
    const data = await postJsonReadOnly<OkRowsResponse | ApiFailure>('/recognition/list', body)
    if (!data.ok) {
      throw toRepositoryErrorReadOnly(data, {
        defaultMessage: 'Recognition report query failed.',
        forbiddenCodes: RECOGNITION_REPORT_FORBIDDEN_CODES,
      })
    }
    return data.rows
  }

  async facets(filters: PartialRecognitionReportFilters): Promise<RecognitionReportFacets> {
    const body = { filters }
    const data = await postJsonReadOnly<OkFacetsResponse | ApiFailure>(
      '/recognition/facets',
      body,
    )
    if (!data.ok) {
      throw toRepositoryErrorReadOnly(data, {
        defaultMessage: 'Recognition report query failed.',
        forbiddenCodes: RECOGNITION_REPORT_FORBIDDEN_CODES,
      })
    }
    return data.facets
  }

  async getFilterOptions(): Promise<RecognitionReportOptions> {
    const data = await getJsonReadOnly<OkOptionsResponse | ApiFailure>(
      '/recognition/filter-options',
    )
    if (!data.ok) {
      throw toRepositoryErrorReadOnly(data, {
        defaultMessage: 'Recognition report query failed.',
        forbiddenCodes: RECOGNITION_REPORT_FORBIDDEN_CODES,
      })
    }
    return data.options
  }
}