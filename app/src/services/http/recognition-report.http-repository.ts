import { env } from '@/app/configuration/env'
import { RepositoryError } from '@/services/contracts/recognition-report.repository'
import type { RecognitionReportRepository } from '@/services/contracts/recognition-report.repository'
import type {
  RecognitionReportFilters,
  RecognitionReportOptions,
  RecognitionReportRow,
} from '@/domain/models/recognition-report'

interface OkRowsResponse {
  ok: true
  rows: RecognitionReportRow[]
}

interface OkOptionsResponse {
  ok: true
  options: RecognitionReportOptions
}

interface ApiFailure {
  ok: false
  code: string
  message: string
}

function isApiFailure(value: unknown): value is ApiFailure {
  if (typeof value !== 'object' || value === null) return false
  return (value as ApiFailure).ok === false
}

function toRepositoryError(failure: ApiFailure): RepositoryError {
  const message = failure.message || 'Recognition report query failed.'
  if (failure.code === 'forbidden' || failure.code === 'UNAUTHORIZED') {
    return new RepositoryError('forbidden', message)
  }
  return new RepositoryError('server-error', message)
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new RepositoryError('server-error', "Couldn't reach the database service.")
  }
  const data = (await response.json().catch(() => null)) as T | ApiFailure | null
  if (!response.ok) {
    throw toRepositoryError(
      isApiFailure(data)
        ? data
        : { ok: false, code: 'unknown', message: 'The database service returned an unexpected error.' },
    )
  }
  return data as T
}

async function getJson<T>(path: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(apiUrl(path))
  } catch {
    throw new RepositoryError('server-error', "Couldn't reach the database service.")
  }
  const data = (await response.json().catch(() => null)) as T | ApiFailure | null
  if (!response.ok) {
    throw toRepositoryError(
      isApiFailure(data)
        ? data
        : { ok: false, code: 'unknown', message: 'The database service returned an unexpected error.' },
    )
  }
  return data as T
}

function apiUrl(path: string): string {
  return `${env.apiBaseUrl.replace(/\/$/, '')}${path}`
}

export class HttpRecognitionReportRepository implements RecognitionReportRepository {
  async list(
    filters: RecognitionReportFilters,
    limit: number,
  ): Promise<RecognitionReportRow[]> {
    const body = { filters, limit }
    const data = await postJson<OkRowsResponse | ApiFailure>('/recognition/list', body)
    if (!data.ok) throw toRepositoryError(data)
    return data.rows
  }

  async getFilterOptions(): Promise<RecognitionReportOptions> {
    const data = await getJson<OkOptionsResponse | ApiFailure>('/recognition/filter-options')
    if (!data.ok) throw toRepositoryError(data)
    return data.options
  }
}
