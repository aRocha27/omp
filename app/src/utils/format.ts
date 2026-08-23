/**
 * Display formatters.
 *
 * The repository returns raw values (UTC instants, numeric prices). Per
 * TIMEZONE.md, conversion to a human-readable form happens at the display
 * boundary only; the wire contract stays UTC ISO + raw numbers.
 */

const priceFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

/** Formats a Sell_Price value. `null`/`undefined` render as an em dash. */
export function formatPrice(value: number | null | undefined): string {
  if (value == null) return '—'
  return priceFormatter.format(value)
}

const dateFormatter = new Intl.DateTimeFormat('en-IE', {
  dateStyle: 'medium',
  timeZone: 'UTC', // DB stores UTC; display the UTC date as-is (TIMEZONE.md)
})

/** Formats an order date (ISO string / Date) for a list cell. */
export function formatOrderDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}