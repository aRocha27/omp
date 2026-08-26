import { env } from '@/app/configuration/env'
import type { DashboardRecognitionQueueItem, DashboardSnapshot } from '@/domain/models/dashboard'
import { RepositoryError, type DashboardRepository } from '@/services/contracts/dashboard.repository'

interface OkDashboardResponse {
  ok: true
  dashboard: DashboardSnapshot
}

interface OkRecognitionQueueResponse {
  ok: true
  recognitionQueue: DashboardRecognitionQueueItem[]
}

interface ApiFailure {
  ok: false
  code: string
  message: string
}

export class HttpDashboardRepository implements DashboardRepository {
  async getSnapshot(): Promise<DashboardSnapshot> {
    const data = await getJson<OkDashboardResponse | ApiFailure>('/dashboard')
    if (!data.ok) throw toRepositoryError(data)
    return {
      year: data.dashboard.year,
      kpis: { ...data.dashboard.kpis },
      monthlyTrend: data.dashboard.monthlyTrend.map((point) => ({ ...point })),
      recognitionQueue: data.dashboard.recognitionQueue.map((row) => ({ ...row })),
      recentOrders: data.dashboard.recentOrders.map((row) => ({ ...row })),
    }
  }

  async getRecognitionQueue(): Promise<DashboardRecognitionQueueItem[]> {
    const data = await getJson<OkRecognitionQueueResponse | ApiFailure>(
      '/dashboard/recognition-queue',
    )
    if (!data.ok) throw toRepositoryError(data)
    return data.recognitionQueue.map((row) => ({ ...row }))
  }
}

function toRepositoryError(failure: ApiFailure): RepositoryError {
  const message = failure.message || 'The database service returned an error.'
  if (failure.code === 'unauthorized' || failure.code === 'forbidden') {
    return new RepositoryError('forbidden', message)
  }
  return new RepositoryError('server-error', message)
}

async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: 'GET' })
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(apiUrl(path), init)
  } catch {
    throw new RepositoryError('server-error', "Couldn't reach the database service.")
  }

  const data = (await response.json().catch(() => null)) as T | ApiFailure | null
  if (!response.ok) {
    const failure = isApiFailure(data)
      ? data
      : {
          ok: false as const,
          code: 'unknown',
          message: 'The database service returned an unexpected error.',
        }
    throw toRepositoryError(failure)
  }
  return data as T
}

function isApiFailure(value: unknown): value is ApiFailure {
  if (typeof value !== 'object' || value === null) return false
  return (value as ApiFailure).ok === false
}

function apiUrl(path: string): string {
  return `${env.apiBaseUrl.replace(/\/$/, '')}${path}`
}
