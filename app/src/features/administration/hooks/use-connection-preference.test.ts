import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  readPreference,
  useConnectionPreference,
} from '@/features/administration/hooks/use-connection-preference'

const KEY = 'omp.admin-connection-preference'

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('readPreference', () => {
  it('returns an empty preference when storage is empty', () => {
    expect(readPreference(window.localStorage)).toEqual({})
  })

  it('returns the stored managed profile id and last sync timestamp', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ lastManagedProfileId: 'orders', lastSyncAt: '2026-08-24T15:00:00.000Z' }),
    )
    expect(readPreference(window.localStorage)).toEqual({
      lastManagedProfileId: 'orders',
      lastSyncAt: '2026-08-24T15:00:00.000Z',
    })
  })

  it('ignores non-string fields and corrupt JSON', () => {
    window.localStorage.setItem(KEY, '{not json')
    expect(readPreference(window.localStorage)).toEqual({})
    window.localStorage.setItem(KEY, JSON.stringify({ lastManagedProfileId: 123 }))
    expect(readPreference(window.localStorage)).toEqual({})
  })
})

describe('useConnectionPreference', () => {
  it('remembers the managed profile id and persists it', () => {
    const { result } = renderHook(() => useConnectionPreference())

    act(() => result.current.rememberManagedProfile('orders'))

    expect(result.current.lastManagedProfileId).toBe('orders')
    expect(window.localStorage.getItem(KEY)).toContain('"lastManagedProfileId":"orders"')
  })

  it('remembers a sync timestamp without dropping the managed profile id', () => {
    const { result } = renderHook(() => useConnectionPreference())
    act(() => result.current.rememberManagedProfile('orders'))
    act(() => result.current.rememberSync())

    expect(result.current.lastManagedProfileId).toBe('orders')
    expect(result.current.lastSyncAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    const stored = JSON.parse(window.localStorage.getItem(KEY) ?? '{}')
    expect(stored.lastManagedProfileId).toBe('orders')
    expect(typeof stored.lastSyncAt).toBe('string')
  })

  it('keeps working when localStorage is unavailable (private mode)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => useConnectionPreference())

    act(() => result.current.rememberManagedProfile('orders'))

    // In-memory state still reflects the choice even if persistence is blocked.
    expect(result.current.lastManagedProfileId).toBe('orders')
  })
})
