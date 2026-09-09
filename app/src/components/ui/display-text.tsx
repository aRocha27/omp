export const DASH = '—'

/**
 * Em-dash fallback for any null/empty display value. Mirrors the
 * `displayText` helper that used to live inside `order-detail-page.tsx`
 * and `client-detail-page.tsx`. Accepts either `string` (orders column
 * values) or `number` (client column values) so both call sites can share
 * the same primitive without re-declaring it.
 */
export function displayText(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return DASH
  const s = String(v)
  return s.length > 0 ? s : DASH
}