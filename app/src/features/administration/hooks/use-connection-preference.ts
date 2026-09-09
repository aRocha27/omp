import { useCallback, useState } from 'react'

/**
 * Persists the Administration tab's connection preference across launches so the
 * database shows as already connected when the tab opens:
 *  - `lastManagedProfileId`: the managed profile the user last connected through, so
 *    auto-connect picks the same one when several are available.
 *  - `lastSyncAt`: ISO timestamp of the most recent successful table sync, surfaced as
 *    a "Last sync" indicator near the connection status.
 *
 * Stored under a dedicated localStorage key (no credentials ever live here — only a
 * profile id and a timestamp), mirroring `use-saved-connections`'s defensive storage.
 */
const PREFERENCE_KEY = 'omp.admin-connection-preference'

export interface ConnectionPreference {
  readonly lastManagedProfileId?: string
  readonly lastSyncAt?: string
}

export function useConnectionPreference() {
  const [preference, setPreference] = useState<ConnectionPreference>(() =>
    readPreference(window.localStorage),
  )

  const rememberManagedProfile = useCallback((profileId: string) => {
    setPreference(writePreference(window.localStorage, { lastManagedProfileId: profileId }))
  }, [])

  const rememberSync = useCallback(() => {
    setPreference(
      writePreference(window.localStorage, {
        lastSyncAt: new Date().toISOString(),
      }),
    )
  }, [])

  return {
    lastManagedProfileId: preference.lastManagedProfileId,
    lastSyncAt: preference.lastSyncAt,
    rememberManagedProfile,
    rememberSync,
  }
}

export function readPreference(storage: Storage): ConnectionPreference {
  try {
    const serialized = storage.getItem(PREFERENCE_KEY)
    if (!serialized) return {}
    const value = JSON.parse(serialized) as unknown
    if (!isRecord(value)) return {}
    const preference: { lastManagedProfileId?: string; lastSyncAt?: string } = {}
    if (typeof value.lastManagedProfileId === 'string') {
      preference.lastManagedProfileId = value.lastManagedProfileId
    }
    if (typeof value.lastSyncAt === 'string') {
      preference.lastSyncAt = value.lastSyncAt
    }
    return preference
  } catch {
    // Corrupt or browser-blocked storage must not prevent Administration from loading.
    return {}
  }
}

function writePreference(storage: Storage, patch: ConnectionPreference): ConnectionPreference {
  const next = { ...readPreference(storage), ...patch }
  try {
    storage.setItem(PREFERENCE_KEY, JSON.stringify(next))
  } catch {
    // In private/browsing-restricted contexts, keep the in-memory state usable.
  }
  return next
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
