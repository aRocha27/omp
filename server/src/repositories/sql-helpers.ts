/**
 * Low-level SQL helpers shared across every repository.
 *
 * - `placeholders(name, count)` — builds `@name0, @name1, …` for a
 *   parameterized `IN (…)` clause. The column name is a hardcoded
 *   constant (never user input), so only the parameter count is dynamic.
 * - The mssql coercion helpers (`numberOrThrow`, `numberOrNull`,
 *   `stringOrNull`, `dateTimeOrEmpty`, `dateTimeOrNull`, `booleanOrNull`)
 *   centralise what used to be inline at the bottom of `db.ts`.
 *
 * mssql returns booleans for `bit` columns, numbers for `int`/`money`,
 * and JS Date objects for `datetime`/`datetime2` columns. The Date
 * helpers coerce to ISO 8601 UTC (TIMEZONE.md); the rest coerce
 * defensively and tolerate null/undefined.
 */
import type { Request as SqlRequest } from 'mssql'

/** Money precision used by every capacity check (recognitions, invoicing). */
export const MONEY_EPSILON = 0.00005

/** Maximum rows per INSERT chunk during propagation (recognitions). */
export const PROPAGATION_CHUNK_SIZE = 500

/** Builds "@name0, @name1, …" for a parameterized IN clause. */
export function placeholders(name: string, count: number): string {
  return Array.from({ length: count }, (_, index) => `@${name}${index}`).join(', ')
}

export function numberOrThrow(row: Record<string, unknown>, key: string): number {
  const value = row[key]
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Expected numeric column ${key} in orders row, got ${typeof value}`)
  }
  return value
}

export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return typeof value === 'number' && !Number.isNaN(value) ? value : Number(value)
}

export function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = typeof value === 'string' ? value : String(value)
  // Whitespace-only values (e.g. legacy rows where `Encomenda_Cli_PHC` was stored as
  // an empty string) collapse to `null` so the UI shows a single `—` placeholder
  // and not a misleading dash with leading spaces.
  const trimmed = text.trim()
  return trimmed === '' ? null : text
}

// datetime columns arrive as JS Date objects; serialize to ISO 8601 UTC. A string is
// passed through (already ISO or a date-only value the formatter parses). Invalid dates
// and unexpected types fall back to the empty/null branch so one bad row can't 502 the
// whole response.
export function dateTimeOrEmpty(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  if (typeof value === 'string') return value
  return ''
}

export function dateTimeOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  if (typeof value === 'string') return value
  return null
}

export function booleanOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  return null
}

/** Re-export so call sites that import `SqlRequest` from this helper don't
 *  have to pull `mssql` themselves. */
export type { SqlRequest }