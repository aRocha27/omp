import { describe, expect, it } from 'vitest'
import { buildDefaultDependencies } from './app.js'
import { buildAdminAuthConfig } from './auth.js'

describe('Administration API security policy', () => {
  it('fails closed for ad-hoc SQL destinations unless explicitly enabled', () => {
    expect(buildDefaultDependencies({}).allowAdHocConnections).toBe(false)
    expect(
      buildDefaultDependencies({ ALLOW_AD_HOC_CONNECTIONS: 'true' }).allowAdHocConnections,
    ).toBe(true)
  })

  it('validates SQL certificates unless an explicit development override is enabled', () => {
    expect(buildDefaultDependencies({}).adHocTrustServerCertificate).toBe(false)
    expect(
      buildDefaultDependencies({ AD_HOC_TRUST_SERVER_CERTIFICATE: 'true' })
        .adHocTrustServerCertificate,
    ).toBe(true)
  })

  it('allows tokenless auth on loopback (dev) and requires a token off-loopback', () => {
    expect(buildAdminAuthConfig({})).toEqual({ token: null })
    expect(buildAdminAuthConfig({ HOST: '127.0.0.1' })).toEqual({ token: null })
    expect(buildAdminAuthConfig({ HOST: 'localhost' })).toEqual({ token: null })
    expect(() => buildAdminAuthConfig({ HOST: '0.0.0.0' })).toThrow('ADMIN_API_TOKEN is required')
    expect(() => buildAdminAuthConfig({ HOST: '192.168.1.5' })).toThrow('ADMIN_API_TOKEN is required')
  })

  it('loads the configured administrator token', () => {
    expect(
      buildAdminAuthConfig({
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        ADMIN_API_TOKEN: 'admin-secret',
      }),
    ).toEqual({ token: 'admin-secret' })
  })
})
