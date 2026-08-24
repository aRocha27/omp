import { useCallback, useState } from 'react'
import type {
  DatabaseConnectionProfile,
  NetworkMode,
} from '@/domain/models/database-connection-profile'

const STORAGE_KEY = 'orderspaisoft.database-connections'

export function useSavedConnections() {
  const [profiles, setProfiles] = useState<DatabaseConnectionProfile[]>(() =>
    readSavedConnections(window.localStorage),
  )

  const saveProfile = useCallback((profile: DatabaseConnectionProfile) => {
    setProfiles(writeSavedConnection(window.localStorage, profile))
  }, [])

  const removeProfile = useCallback((id: string) => {
    setProfiles(removeSavedConnection(window.localStorage, id))
  }, [])

  return { profiles, saveProfile, removeProfile }
}

export function readSavedConnections(storage: Storage): DatabaseConnectionProfile[] {
  try {
    const serialized = storage.getItem(STORAGE_KEY)
    if (!serialized) return []
    const value = JSON.parse(serialized) as unknown
    if (!Array.isArray(value)) return []
    return value.filter(isConnectionProfile).map(toStorableProfile)
  } catch {
    // Corrupt or browser-blocked storage must not prevent Administration from loading.
    return []
  }
}

export function writeSavedConnection(
  storage: Storage,
  profile: DatabaseConnectionProfile,
): DatabaseConnectionProfile[] {
  const safeProfile = toStorableProfile(profile)
  const current = readSavedConnections(storage)
  const existingIndex = current.findIndex((item) => item.id === safeProfile.id)
  const next = [...current]

  if (existingIndex === -1) next.push(safeProfile)
  else next[existingIndex] = safeProfile

  persist(storage, next)
  return next
}

export function removeSavedConnection(storage: Storage, id: string): DatabaseConnectionProfile[] {
  const next = readSavedConnections(storage).filter((profile) => profile.id !== id)
  persist(storage, next)
  return next
}

function persist(storage: Storage, profiles: DatabaseConnectionProfile[]): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(profiles))
  } catch {
    // In private/browsing-restricted contexts, keep the in-memory state usable.
  }
}

function toStorableProfile(profile: DatabaseConnectionProfile): DatabaseConnectionProfile {
  return {
    id: profile.id,
    name: profile.name,
    networkMode: profile.networkMode,
    server: profile.server,
    port: profile.port,
    ...(profile.database ? { database: profile.database } : {}),
    user: profile.user,
    ...(profile.schema ? { schema: profile.schema } : {}),
    ...(profile.table ? { table: profile.table } : {}),
  }
}

function isConnectionProfile(value: unknown): value is DatabaseConnectionProfile {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isNetworkMode(value.networkMode) &&
    typeof value.server === 'string' &&
    typeof value.port === 'number' &&
    Number.isInteger(value.port) &&
    value.port >= 1 &&
    value.port <= 65535 &&
    typeof value.user === 'string' &&
    isOptionalString(value.database) &&
    isOptionalString(value.schema) &&
    isOptionalString(value.table)
  )
}

function isNetworkMode(value: unknown): value is NetworkMode {
  return value === 'lan' || value === 'private-remote' || value === 'cloud'
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
