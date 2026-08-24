import { describe, expect, it } from 'vitest'
import { listProfileMetadata, resolveProfile } from './profiles.js'

const profileEnvironment = {
  PROFILES: 'portugal-production,development-sql',
  PROFILE__PORTUGAL_PRODUCTION__NAME: 'Portugal Production',
  PROFILE__PORTUGAL_PRODUCTION__NETWORK_MODE: 'private-remote',
  PROFILE__PORTUGAL_PRODUCTION__SERVER: 'sql-orders.internal',
  PROFILE__PORTUGAL_PRODUCTION__PORT: '1433',
  PROFILE__PORTUGAL_PRODUCTION__DATABASE: 'Orders',
  PROFILE__PORTUGAL_PRODUCTION__USER: 'orders_app',
  PROFILE__PORTUGAL_PRODUCTION__PASSWORD: 'production-secret',
  PROFILE__DEVELOPMENT_SQL__NAME: 'Development SQL',
  PROFILE__DEVELOPMENT_SQL__NETWORK_MODE: 'lan',
  PROFILE__DEVELOPMENT_SQL__SERVER: '192.168.1.25',
  PROFILE__DEVELOPMENT_SQL__PORT: '1433',
  PROFILE__DEVELOPMENT_SQL__USER: 'dev_user',
  PROFILE__DEVELOPMENT_SQL__PASSWORD: 'dev-secret',
}

describe('backend-managed connection profiles', () => {
  it('lists only public metadata and never returns credentials', () => {
    const profiles = listProfileMetadata(profileEnvironment)

    expect(profiles).toEqual([
      {
        id: 'portugal-production',
        name: 'Portugal Production',
        networkMode: 'private-remote',
      },
      {
        id: 'development-sql',
        name: 'Development SQL',
        networkMode: 'lan',
      },
    ])
    expect(JSON.stringify(profiles)).not.toContain('production-secret')
    expect(JSON.stringify(profiles)).not.toContain('orders_app')
    expect(JSON.stringify(profiles)).not.toContain('sql-orders.internal')
  })

  it('resolves a selected profile entirely on the backend', () => {
    expect(resolveProfile('portugal-production', profileEnvironment)).toEqual({
      server: 'sql-orders.internal',
      port: 1433,
      database: 'Orders',
      user: 'orders_app',
      password: 'production-secret',
    })
  })

  it('rejects unknown and incomplete profiles', () => {
    expect(() => resolveProfile('missing', profileEnvironment)).toThrow(
      'Unknown connection profile',
    )
    expect(() =>
      resolveProfile('portugal-production', {
        ...profileEnvironment,
        PROFILE__PORTUGAL_PRODUCTION__PASSWORD: '',
      }),
    ).toThrow('is not configured correctly')
  })

  it('rejects invalid network modes and ports', () => {
    expect(() =>
      listProfileMetadata({
        ...profileEnvironment,
        PROFILE__PORTUGAL_PRODUCTION__NETWORK_MODE: 'public-internet',
      }),
    ).toThrow('network mode')
    expect(() =>
      resolveProfile('portugal-production', {
        ...profileEnvironment,
        PROFILE__PORTUGAL_PRODUCTION__PORT: '70000',
      }),
    ).toThrow('port')
  })
})
