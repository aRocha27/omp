import { describe, expect, it } from 'vitest'
import {
  connectBodySchema,
  facturacaoDeleteBodySchema,
  facturacaoUpdateBodySchema,
  orderWarrantyYearsBodySchema,
  reconhecimentoDeleteBodySchema,
  reconhecimentoPropagateBodySchema,
  reconhecimentoUpdateBodySchema,
  syncBodySchema,
} from './validation.js'

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

describe('order sub-table mutation validation', () => {
  it('accepts a partial recognition update and strips unknown patch keys', () => {
    expect(
      reconhecimentoUpdateBodySchema.parse({
        id: 7,
        patch: {
          ID_Tp_Reconhecimento: 'WP',
          DT_Reconhecimento: '2027-01-01T00:00:00Z',
          Valor_Reconhecimento: 125.5,
          ID_Order: 999,
        },
      }),
    ).toEqual({
      id: 7,
      patch: {
        ID_Tp_Reconhecimento: 'WP',
        DT_Reconhecimento: '2027-01-01T00:00:00Z',
        Valor_Reconhecimento: 125.5,
      },
    })
  })

  it('rejects invalid recognition update and delete identifiers', () => {
    expect(
      reconhecimentoUpdateBodySchema.safeParse({
        id: 0,
        patch: { Valor_Reconhecimento: -1 },
      }).success,
    ).toBe(false)
    expect(reconhecimentoDeleteBodySchema.safeParse({ id: -1 }).success).toBe(false)
  })

  it('requires maintenance propagation inputs but not warranty inputs', () => {
    expect(reconhecimentoPropagateBodySchema.parse({ orderId: 101, kind: 'warranty' })).toEqual({
      orderId: 101,
      kind: 'warranty',
    })

    expect(
      reconhecimentoPropagateBodySchema.safeParse({ orderId: 101, kind: 'maintenance' }).success,
    ).toBe(false)
    expect(
      reconhecimentoPropagateBodySchema.safeParse({
        orderId: 101,
        kind: 'maintenance',
        startDate: '2027-02-18',
        years: 3,
      }).success,
    ).toBe(false)
    expect(
      reconhecimentoPropagateBodySchema.parse({
        orderId: 101,
        kind: 'maintenance',
        startDate: '2027-02-18',
        years: 3,
        recognitionDate: '2027-06-21',
      }),
    ).toEqual({
      orderId: 101,
      kind: 'maintenance',
      startDate: '2027-02-18',
      years: 3,
      recognitionDate: '2027-06-21',
    })
    expect(
      reconhecimentoPropagateBodySchema.safeParse({
        orderId: 101,
        kind: 'maintenance',
        startDate: '2027-02-18',
        years: 1.5,
        recognitionDate: '2027-06-21',
      }).success,
    ).toBe(false)
    expect(
      reconhecimentoPropagateBodySchema.safeParse({
        orderId: 101,
        kind: 'maintenance',
        startDate: '2027-02-18',
        years: 101,
        recognitionDate: '2027-06-21',
      }).success,
    ).toBe(false)
    expect(
      reconhecimentoPropagateBodySchema.safeParse({
        orderId: 101,
        kind: 'maintenance',
        startDate: '2027-02-18',
        years: 1,
        recognitionDate: 'not-a-date',
      }).success,
    ).toBe(false)
  })

  it('accepts editable invoicing fields and rejects invalid deletes', () => {
    expect(
      facturacaoUpdateBodySchema.parse({
        id: 3,
        patch: {
          DT_Doc_FT: '2026-09-01',
          ID_Tp_Doc_FT: 'NC',
          N_Doc_FT: 'NC 1',
          Valor_Doc_FT: -100,
          ID_Order: 999,
        },
      }),
    ).toEqual({
      id: 3,
      patch: {
        DT_Doc_FT: '2026-09-01',
        ID_Tp_Doc_FT: 'NC',
        N_Doc_FT: 'NC 1',
        Valor_Doc_FT: -100,
      },
    })
    expect(facturacaoDeleteBodySchema.safeParse({ id: 0 }).success).toBe(false)
  })

  it('accepts a warranty-years update within the 1..5 range', () => {
    expect(orderWarrantyYearsBodySchema.parse({ id: 101, years: 3 })).toEqual({ id: 101, years: 3 })
    expect(orderWarrantyYearsBodySchema.safeParse({ id: 0, years: 3 }).success).toBe(false)
    expect(orderWarrantyYearsBodySchema.safeParse({ id: 101, years: 0 }).success).toBe(false)
    expect(orderWarrantyYearsBodySchema.safeParse({ id: 101, years: 1.5 }).success).toBe(false)
    expect(orderWarrantyYearsBodySchema.safeParse({ id: 101, years: 101 }).success).toBe(false)
  })
})
