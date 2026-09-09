/**
 * Shared HTTP plumbing used by every `*.http-repository.ts` implementation.
 *
 * Centralises the bits that used to be copy-pasted into each repo:
 *   - `apiUrl(path)` — prefixes the configured `env.apiBaseUrl`
 *   - `getJson` / `postJson` — typed wrappers over `requestJson` that add the
 *     optional role header expected by the backend's authorization gate
 *   - `requestJson` — single `fetch` site that decodes JSON, distinguishes
 *     `ApiFailure` envelopes, and throws `RepositoryError`
 *   - `toRepositoryError` — failure → `RepositoryError` mapper; the caller
 *     picks the default message and the set of failure codes that should
 *     collapse to `'forbidden'`
 *
 * The `notFoundStatus` parameter preserves the pre-existing behaviour where
 * mutations (POST update/delete) treat 404 as a generic server error but
 * detail reads (GET `…?id=N`) treat 404 as `RepositoryError('not-found')`.
 */

import { env } from '@/app/configuration/env'
import { RepositoryError } from '@/services/contracts/orders.repository'
import type { RoleLike } from '@/domain/models/user'

export interface ApiFailure {
  ok: false
  code: string
  message: string
}

export function apiUrl(path: string): string {
  return `${env.apiBaseUrl}${path}`
}

export function isApiFailure(value: unknown): value is ApiFailure {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    (value as { ok: unknown }).ok === false &&
    'code' in value &&
    'message' in value
  )
}

/**
 * Map an `ApiFailure` envelope to a `RepositoryError`.
 *
 * Default `forbiddenCodes` covers `unauthorized` and `forbidden`. Repos that
 * also surface `field-locked` (server's defense-in-depth gate for the
 * Caracterização lock) extend the set; this is the only divergence between
 * the read-only and the read/write repos.
 *
 * `defaultMessage` keeps each repo's existing user-visible fallback string
 * (e.g. `Recognition report query failed.`).
 */
export function toRepositoryError(
  failure: ApiFailure,
  options: {
    defaultMessage: string
    forbiddenCodes?: ReadonlySet<string>
    notFoundStatus?: number
  },
): RepositoryError {
  const forbidden = options.forbiddenCodes ?? new Set(['unauthorized', 'forbidden'])
  const message = failure.message || options.defaultMessage
  if (forbidden.has(failure.code)) {
    return new RepositoryError('forbidden', message)
  }
  if (options.notFoundStatus === 404) return new RepositoryError('not-found', message)
  return new RepositoryError('server-error', message)
}

/** Shared 2-arg convenience (matches the most common call shape). */
export function toRepositoryErrorSimple(
  failure: ApiFailure,
  notFoundStatus: number,
  forbiddenCodes?: ReadonlySet<string>,
): RepositoryError {
  return toRepositoryError(failure, {
    defaultMessage: 'The database service returned an error.',
    forbiddenCodes,
    notFoundStatus,
  })
}

/** Shared 1-arg convenience for repos that never produce a 404. */
export function toRepositoryErrorServer(
  failure: ApiFailure,
  options: { defaultMessage?: string; forbiddenCodes?: ReadonlySet<string> } = {},
): RepositoryError {
  return toRepositoryError(failure, {
    defaultMessage: options.defaultMessage ?? 'The database service returned an error.',
    forbiddenCodes: options.forbiddenCodes,
  })
}

/**
 * Lower-level failure mapper that mirrors the original
 * `requestJson` semantics exactly: the failure is thrown without consulting
 * `notFoundStatus`, so any non-ok status collapses to `'server-error'`
 * unless the failure code is in the forbidden set. Read-only repos that
 * never surface 404 (dashboard, invoicing, reference) keep this contract.
 */
export function toRepositoryErrorReadOnly(
  failure: ApiFailure,
  options: { defaultMessage?: string; forbiddenCodes?: ReadonlySet<string> } = {},
): RepositoryError {
  return toRepositoryError(failure, {
    defaultMessage: options.defaultMessage ?? 'The database service returned an error.',
    forbiddenCodes: options.forbiddenCodes,
  })
}

export async function requestJson<T>(
  path: string,
  init: RequestInit,
  options: { defaultMessage?: string; forbiddenCodes?: ReadonlySet<string> } = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(apiUrl(path), { ...init, credentials: 'include', headers: withDatabaseSelection(init.headers) })
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
    throw toRepositoryError(failure, {
      defaultMessage: options.defaultMessage ?? 'The database service returned an error.',
      forbiddenCodes: options.forbiddenCodes,
      notFoundStatus: response.status,
    })
  }
  return data as T
}

function withDatabaseSelection(headers?: HeadersInit): Headers {
  const result = new Headers(headers)
  const token = window.sessionStorage.getItem('omp.database-selection')
  if (token) result.set('X-Database-Selection', token)
  return result
}

/**
 * Variant of `requestJson` that never treats 404 as `not-found`. Used by
 * read-only repos (dashboard, invoicing, reference) where the original
 * implementation threw `server-error` for every non-ok status.
 */
export async function requestJsonReadOnly<T>(
  path: string,
  init: RequestInit,
  options: { defaultMessage?: string; forbiddenCodes?: ReadonlySet<string> } = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(apiUrl(path), { ...init, credentials: 'include', headers: withDatabaseSelection(init.headers) })
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
    throw toRepositoryError(failure, {
      defaultMessage: options.defaultMessage ?? 'The database service returned an error.',
      forbiddenCodes: options.forbiddenCodes,
    })
  }
  return data as T
}

export async function getJson<T>(
  path: string,
  options: { defaultMessage?: string; forbiddenCodes?: ReadonlySet<string> } = {},
): Promise<T> {
  return requestJson<T>(path, { method: 'GET' }, options)
}

export async function getJsonReadOnly<T>(
  path: string,
  options: { defaultMessage?: string; forbiddenCodes?: ReadonlySet<string> } = {},
): Promise<T> {
  return requestJsonReadOnly<T>(path, { method: 'GET' }, options)
}

export async function postJson<T>(
  path: string,
  body: unknown,
  role?: RoleLike,
  options: { defaultMessage?: string; forbiddenCodes?: ReadonlySet<string> } = {},
): Promise<T> {
  return requestJson<T>(
    path,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(role ? { 'X-User-Role': role } : {}),
      },
      body: JSON.stringify(body),
    },
    options,
  )
}

export async function postJsonReadOnly<T>(
  path: string,
  body: unknown,
  options: { defaultMessage?: string; forbiddenCodes?: ReadonlySet<string> } = {},
): Promise<T> {
  return requestJsonReadOnly<T>(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    options,
  )
}

/**
 * POST with caller-supplied extra headers (no role header is added by the
 * helper). Used by `clients.http-repository.ts` because the legacy
 * implementation sends the role as lowercase `'x-user-role'` (verified by
 * the existing HTTP test); the `postJson` helper normalises to
 * `'X-User-Role'` instead.
 */
export async function postJsonWithExtraHeaders<T>(
  path: string,
  body: unknown,
  extraHeaders: Record<string, string>,
  options: { defaultMessage?: string; forbiddenCodes?: ReadonlySet<string> } = {},
): Promise<T> {
  return requestJson<T>(
    path,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    },
    options,
  )
}

/**
 * Unreachable TypeScript narrowing helper. `requestJson` always throws on
 * a non-ok response, so the `!data.ok` branch can never run; this function
 * exists purely to narrow the discriminated union and reach the success
 * type. It throws the failure itself so the runtime behaviour matches the
 * type signature even if a future refactor accidentally bypasses
 * `requestJson`'s throwing path.
 */
export function unwrapApiFailure<T extends { ok: true }>(
  data: T | ApiFailure,
): T {
  if (!data.ok) throw data
  return data
}
