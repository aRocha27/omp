/**
 * Unit tests for recognition propagation rules (req 10 & 12).
 */
import { describe, expect, it } from 'vitest'
import {
  planMaintenancePropagation,
  planWarrantyPropagation,
  warrantyYears,
  type MaintenancePropagationOrder,
  type WarrantyPropagationOrder,
} from '@/domain/rules/propagation'

describe('warrantyYears', () => {
  it('maps ID_Tp_Warranty 1/2/3 → 1/2/3 (live dbo.Tp_Warranty)', () => {
    expect(warrantyYears(1)).toBe(1)
    expect(warrantyYears(2)).toBe(2)
    expect(warrantyYears(3)).toBe(3)
  })

  it('falls back to 1 when the order has no warranty type', () => {
    expect(warrantyYears(null)).toBe(1)
  })
})

describe('planWarrantyPropagation', () => {
  const base: WarrantyPropagationOrder = {
    Tipo_Warranty: true,
    ID_Tp_Warranty: 2,
    Warranty_Reserve: 6600,
    Warranty_DT_Inicio: '2025-09-13',
  }

  it('generates (N_Anos − 1) × 12 WP lines starting 12 months after start', () => {
    // 2 years → (2−1)×12 = 12 lines; start 2025-09 + 12 months = 2026-09.
    const lines = planWarrantyPropagation(base)
    expect(lines).toHaveLength(12)
    expect(lines.every((l) => l.type === 'WP')).toBe(true)
    expect(lines[0].date).toContain('2026-09-01')
    expect(lines[11].date).toContain('2027-08-01')
  })

  it('divides the reserve evenly across the months', () => {
    // 6600 / 12 = 550.
    const lines = planWarrantyPropagation(base)
    expect(lines[0].value).toBe(550)
    expect(lines[11].value).toBe(550)
  })

  it('distributes four-decimal SQL money units so the propagated total equals the reserve', () => {
    const lines = planWarrantyPropagation({ ...base, Warranty_Reserve: 100.0001 })
    expect(lines.reduce((sum, line) => sum + line.value, 0)).toBeCloseTo(100.0001, 4)
    expect(new Set(lines.map((line) => line.value))).toEqual(new Set([8.3334, 8.3333]))
  })

  it('returns no lines for a 1-year warranty (meses = 0)', () => {
    const lines = planWarrantyPropagation({ ...base, ID_Tp_Warranty: 1 })
    expect(lines).toEqual([])
  })

  it('returns no lines for a 3-year warranty → 24 lines', () => {
    const lines = planWarrantyPropagation({ ...base, ID_Tp_Warranty: 3, Warranty_Reserve: 7200 })
    expect(lines).toHaveLength(24)
    // 7200 / 24 = 300.
    expect(lines[0].value).toBe(300)
  })

  it('returns no lines for a non-warranty order kind', () => {
    const lines = planWarrantyPropagation({ ...base, Tipo_Warranty: false })
    expect(lines).toEqual([])
  })

  it('returns no lines when the start date is missing', () => {
    const lines = planWarrantyPropagation({ ...base, Warranty_DT_Inicio: null })
    expect(lines).toEqual([])
  })

  it('returns no lines when the reserve is missing or zero', () => {
    expect(planWarrantyPropagation({ ...base, Warranty_Reserve: null })).toEqual([])
    expect(planWarrantyPropagation({ ...base, Warranty_Reserve: 0 })).toEqual([])
  })
})

describe('planMaintenancePropagation', () => {
  const cm: MaintenancePropagationOrder = { ID_Tipo: 'CM', Sell_Price: 12000 }

  it('generates years × 12 CM lines from the contract start when no catch-up is needed', () => {
    const lines = planMaintenancePropagation(cm, '2025-01-15', 1, '2025-01-15')
    expect(lines).toHaveLength(12)
    expect(lines.every((l) => l.type === 'CM')).toBe(true)
    // Start normalized to first of month → 2025-01-01.
    expect(lines[0].date).toContain('2025-01-01')
    expect(lines[11].date).toContain('2025-12-01')
  })

  it('moves elapsed installments to the recognition month and keeps future dates', () => {
    const lines = planMaintenancePropagation(cm, '2026-01-15', 1, '2026-06-25')

    expect(lines).toHaveLength(12)
    // Jan–Jun installments are all recognized in June. The June scheduled line
    // already lands in that month, so the first six rows share 1 June.
    expect(lines.slice(0, 6).map((line) => line.date)).toEqual(
      Array.from({ length: 6 }, () => '2026-06-01T00:00:00.000Z'),
    )
    expect(lines.slice(6).map((line) => line.date)).toEqual([
      '2026-07-01T00:00:00.000Z',
      '2026-08-01T00:00:00.000Z',
      '2026-09-01T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z',
      '2026-11-01T00:00:00.000Z',
      '2026-12-01T00:00:00.000Z',
    ])
    expect(lines.reduce((sum, line) => sum + line.value, 0)).toBe(12000)
  })

  it('divides Sell_Price evenly across years × 12 months', () => {
    // 12000 / (2 × 12) = 500.
    const lines = planMaintenancePropagation(cm, '2025-01-01', 2, '2025-01-01')
    expect(lines).toHaveLength(24)
    expect(lines[0].value).toBe(500)
  })

  it('distributes four-decimal SQL money units so maintenance rows total Sell Price', () => {
    const lines = planMaintenancePropagation(
      { ID_Tipo: 'CM', Sell_Price: 100.0001 },
      '2025-01-01',
      1,
      '2025-01-01',
    )
    expect(lines.reduce((sum, line) => sum + line.value, 0)).toBeCloseTo(100.0001, 4)
    expect(new Set(lines.map((line) => line.value))).toEqual(new Set([8.3334, 8.3333]))
  })

  it('returns no lines for a non-CM order kind', () => {
    expect(
      planMaintenancePropagation(
        { ID_Tipo: 'INSTR', Sell_Price: 12000 },
        '2025-01-01',
        1,
        '2025-06-01',
      ),
    ).toEqual([])
  })

  it('returns no lines when Sell_Price is missing or non-positive', () => {
    expect(
      planMaintenancePropagation(
        { ID_Tipo: 'CM', Sell_Price: null },
        '2025-01-01',
        1,
        '2025-06-01',
      ),
    ).toEqual([])
    expect(
      planMaintenancePropagation(
        { ID_Tipo: 'CM', Sell_Price: 0 },
        '2025-01-01',
        1,
        '2025-06-01',
      ),
    ).toEqual([])
  })

  it('throws when startDate, years, or recognitionDate is missing', () => {
    expect(() => planMaintenancePropagation(cm, undefined, 1, '2025-01-01')).toThrow()
    expect(() =>
      planMaintenancePropagation(cm, '2025-01-01', undefined, '2025-01-01'),
    ).toThrow()
    expect(() => planMaintenancePropagation(cm, '2025-01-01', 1, undefined)).toThrow()
  })

  it('throws when a maintenance date is invalid', () => {
    expect(() => planMaintenancePropagation(cm, 'not-a-date', 1, '2025-01-01')).toThrow(
      'Contract start date is invalid.',
    )
    expect(() => planMaintenancePropagation(cm, '2025-01-01', 1, 'not-a-date')).toThrow(
      'Recognition date is invalid.',
    )
  })

  it('throws when years is outside the integer 1–100 range', () => {
    expect(() => planMaintenancePropagation(cm, '2025-01-01', 0, '2025-01-01')).toThrow()
    expect(() => planMaintenancePropagation(cm, '2025-01-01', 1.5, '2025-01-01')).toThrow()
    expect(() => planMaintenancePropagation(cm, '2025-01-01', 101, '2025-01-01')).toThrow()
  })
})
