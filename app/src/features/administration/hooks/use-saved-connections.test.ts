import { beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseConnectionProfile } from '@/domain/models/database-connection-profile'
import {
  readSavedConnections,
  removeSavedConnection,
  writeSavedConnection,
} from './use-saved-connections'

const profile: DatabaseConnectionProfile = {
  id: 'dev-sql',
  name: 'Development SQL',
  networkMode: 'lan',
  server: '192.168.1.25',
  port: 1433,
  database: 'Orders',
  user: 'orders_app',
  schema: 'dbo',
  table: 'Orders',
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('saved ad-hoc connection profiles', () => {
  it('persists only profile metadata and never persists a password', () => {
    writeSavedConnection(window.localStorage, {
      ...profile,
      password: 'must-not-be-stored',
    } as DatabaseConnectionProfile & { password: string })

    expect(readSavedConnections(window.localStorage)).toEqual([profile])
    expect(JSON.stringify(window.localStorage)).not.toContain('must-not-be-stored')
    expect(window.localStorage.getItem('omp.database-connections')).not.toContain(
      'must-not-be-stored',
    )
  })

  it('updates an existing profile without creating a duplicate', () => {
    writeSavedConnection(window.localStorage, profile)
    writeSavedConnection(window.localStorage, { ...profile, table: 'V_Order_List' })

    expect(readSavedConnections(window.localStorage)).toEqual([
      { ...profile, table: 'V_Order_List' },
    ])
  })

  it('removes a saved profile', () => {
    writeSavedConnection(window.localStorage, profile)
    removeSavedConnection(window.localStorage, profile.id)

    expect(readSavedConnections(window.localStorage)).toEqual([])
  })

  it('recovers safely from malformed storage', () => {
    window.localStorage.setItem('omp.database-connections', '{not-json')
    expect(readSavedConnections(window.localStorage)).toEqual([])
  })
})
