import { describe, expect, it } from 'vitest'
import { connectBodySchema, syncBodySchema } from './validation.js'

const credentials = {
  server: 'sql-orders.internal',
  port: 1433,
  database: 'Orders',
  user: 'orders_app',
  password: 'secret',
}

describe('connection request validation', () => {
  it('accepts either ad-hoc credentials or a backend-managed profile', () => {
    expect(connectBodySchema.parse({ credentials })).toEqual({ credentials })
    expect(connectBodySchema.parse({ profileId: 'portugal-production' })).toEqual({
      profileId: 'portugal-production',
    })
  })

  it('rejects neither or both connection sources with accurate messages', () => {
    const neither = connectBodySchema.safeParse({})
    const both = connectBodySchema.safeParse({ credentials, profileId: 'production' })

    expect(neither.success).toBe(false)
    expect(both.success).toBe(false)
    if (!neither.success) {
      expect(neither.error.issues[0]?.message).toBe('Provide either credentials or profileId')
    }
    if (!both.success) {
      expect(both.error.issues[0]?.message).toBe(
        'Provide either credentials or profileId, not both',
      )
    }
  })

  it('rejects invalid credentials and ports', () => {
    expect(
      connectBodySchema.safeParse({ credentials: { ...credentials, server: '' } }).success,
    ).toBe(false)
    expect(connectBodySchema.safeParse({ credentials: { ...credentials, port: 0 } }).success).toBe(
      false,
    )
    expect(
      connectBodySchema.safeParse({ credentials: { ...credentials, port: 65536 } }).success,
    ).toBe(false)
  })

  it('defaults sync limits and rejects invalid table input', () => {
    expect(
      syncBodySchema.parse({
        profileId: 'production',
        schema: 'dbo',
        table: 'Orders',
      }).limit,
    ).toBe(200)
    expect(
      syncBodySchema.safeParse({
        profileId: 'production',
        schema: '',
        table: 'Orders',
      }).success,
    ).toBe(false)
  })
})
