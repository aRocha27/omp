/**
 * Date helpers shared by the DatePicker and any other ISO-aware component.
 *
 * The wire format everywhere in the app is ISO date `YYYY-MM-DD` (UTC, no
 * time component — see TIMEZONE.md). `formatIsoToDisplay` and
 * `parseDisplayToIso` translate between ISO and the `dd/mm/yyyy` text format
 * used by a few legacy read-only displays. `isValidIsoDate` is the canonical
 * "is this string a real calendar date" check used by every code path that
 * receives a date string from the outside.
 *
 * No `new Date()` involvement on the input side — the picker treats the
 * value as a calendar string, never a moment in time. The native
 * `<input type="date">` does its own display formatting in the OS locale.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** True when `iso` matches the `YYYY-MM-DD` shape and the calendar date is real
 * (no Feb 30, no month 13). Year range is intentionally unbounded so historical
 * or future orders still parse. */
export function isValidIsoDate(iso: string): boolean {
  if (!ISO_DATE.test(iso)) return false
  const [y, m, d] = iso.split('-').map(Number)
  if (m < 1 || m > 12) return false
  if (d < 1 || d > 31) return false
  const probe = new Date(Date.UTC(y, m - 1, d))
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  )
}

/** Format an ISO date string as `dd/mm/yyyy` for human-readable displays.
 * Returns `''` for null/empty/invalid. */
export function formatIsoToDisplay(iso: string | null | undefined): string {
  if (!iso) return ''
  if (!isValidIsoDate(iso)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Parse a user-typed `dd/mm/yyyy` string into the canonical ISO `YYYY-MM-DD`.
 *
 * Returns `null` for empty input (so the picker can clear the field) and `undefined`
 * for a partial / malformed value (so the picker can keep the user's keystrokes on
 * screen without committing a broken value). The contract:
 *
 *  - `''`           → `null`     (cleared; matches the picker "no date" state)
 *  - `'01/02/2026'` → `'2026-02-01'`
 *  - `'1/2/26'`     → `undefined` (ambiguous — too short to commit)
 *  - `'99/99/2026'` → `undefined` (not a real calendar date)
 *
 * The two `undefined` cases both mean "don't fire onChange yet"; the picker keeps
 * the typed text in its local state until either the value resolves to a real date
 * (commit) or the user clears the field (emit null).
 */
export function parseDisplayToIso(display: string): string | null | undefined {
  const trimmed = display.trim()
  if (trimmed === '') return null
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
  if (!match) return undefined
  const [, dStr, mStr, yStr] = match
  const day = Number(dStr)
  const month = Number(mStr)
  const iso = `${yStr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  if (!isValidIsoDate(iso)) return undefined
  // Reject partial-but-numeric strings that happen to be a real date by accident
  // (e.g. "01/02/2026" is valid; "1/2/2026" should be considered incomplete). The
  // user has to type the full dd/mm/yyyy before we commit.
  if (dStr.length !== 2 || mStr.length !== 2 || yStr.length !== 4) return undefined
  return iso
}