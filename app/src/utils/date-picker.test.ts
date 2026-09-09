import { describe, expect, it } from 'vitest'
import { formatIsoToDisplay, isValidIsoDate, parseDisplayToIso } from '@/utils/date-picker'

describe('isValidIsoDate', () => {
  it('accepts a valid calendar date', () => {
    expect(isValidIsoDate('2026-08-26')).toBe(true)
  })

  it('accepts a leap-day in a leap year', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true)
  })

  it('rejects Feb 29 in a non-leap year', () => {
    expect(isValidIsoDate('2025-02-29')).toBe(false)
  })

  it('rejects Feb 30 (never a real date)', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false)
  })

  it('rejects month 13', () => {
    expect(isValidIsoDate('2026-13-01')).toBe(false)
  })

  it('rejects strings that do not match the YYYY-MM-DD shape', () => {
    expect(isValidIsoDate('2026-8-26')).toBe(false)
    expect(isValidIsoDate('26/08/2026')).toBe(false)
    expect(isValidIsoDate('')).toBe(false)
  })
})

describe('formatIsoToDisplay', () => {
  it('formats a valid ISO as dd/mm/yyyy', () => {
    expect(formatIsoToDisplay('2026-08-26')).toBe('26/08/2026')
  })

  it('zero-pads the day and month', () => {
    expect(formatIsoToDisplay('2026-01-05')).toBe('05/01/2026')
  })

  it('returns empty string for nullish / empty / invalid input', () => {
    expect(formatIsoToDisplay(null)).toBe('')
    expect(formatIsoToDisplay(undefined)).toBe('')
    expect(formatIsoToDisplay('')).toBe('')
    expect(formatIsoToDisplay('not a date')).toBe('')
    expect(formatIsoToDisplay('2026-02-30')).toBe('')
  })
})

describe('parseDisplayToIso', () => {
  it('parses a valid dd/mm/yyyy to ISO', () => {
    expect(parseDisplayToIso('15/04/2030')).toBe('2030-04-15')
    expect(parseDisplayToIso('01/01/2026')).toBe('2026-01-01')
  })

  it('returns null for empty / whitespace (cleared field)', () => {
    expect(parseDisplayToIso('')).toBeNull()
    expect(parseDisplayToIso('   ')).toBeNull()
  })

  it('returns undefined for partial input (still typing)', () => {
    expect(parseDisplayToIso('1')).toBeUndefined()
    expect(parseDisplayToIso('1/')).toBeUndefined()
    expect(parseDisplayToIso('1/2')).toBeUndefined()
    expect(parseDisplayToIso('1/2/')).toBeUndefined()
  })

  it('returns undefined for ambiguous single-digit dd/mm/yyyy', () => {
    // The user has to type the full dd/mm/yyyy before the picker commits.
    expect(parseDisplayToIso('1/2/2026')).toBeUndefined()
    expect(parseDisplayToIso('01/2/2026')).toBeUndefined()
    expect(parseDisplayToIso('1/02/2026')).toBeUndefined()
  })

  it('returns undefined for an invalid calendar date', () => {
    expect(parseDisplayToIso('30/02/2026')).toBeUndefined() // Feb 30
    expect(parseDisplayToIso('31/04/2026')).toBeUndefined() // Apr 31
    expect(parseDisplayToIso('99/99/2026')).toBeUndefined()
  })

  it('returns undefined for the wrong separator', () => {
    expect(parseDisplayToIso('15-04-2030')).toBeUndefined()
    expect(parseDisplayToIso('15.04.2030')).toBeUndefined()
  })
})