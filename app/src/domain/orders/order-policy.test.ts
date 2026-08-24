import { describe, expect, it } from 'vitest'
import type { Order } from '@/domain/models/order'
import {
  LOCKED_CARACTERIZACAO,
  canEditField,
  isHistorico,
  isLockedCaracterizacaoField,
  orderEstado,
  startOfCurrentMonthUTC,
} from './order-policy'

// Fixed "now" so the year+month boundary is deterministic. 2026-08-24.
const NOW = new Date('2026-08-24T10:00:00Z')
const THIS_MONTH = '2026-08-10T00:00:00Z'
const LAST_MONTH = '2026-07-15T00:00:00Z'
const LAST_YEAR_DECEMBER = '2025-12-15T00:00:00Z'

type PickOrder = Pick<Order, 'DT_Order' | 'Provisoria'>

const order = (DT_Order: string, Provisoria: boolean | null = false): PickOrder => ({
  DT_Order,
  Provisoria,
})

describe('startOfCurrentMonthUTC', () => {
  it('returns the first instant of the current month in UTC', () => {
    expect(startOfCurrentMonthUTC(NOW)).toEqual(new Date('2026-08-01T00:00:00Z'))
  })
})

describe('isHistorico', () => {
  it('is true for a past-month non-provisória order', () => {
    expect(isHistorico(order(LAST_MONTH), NOW)).toBe(true)
  })

  it('is true for a previous-year December order when now is January (year+month compare)', () => {
    const janNow = new Date('2026-01-10T00:00:00Z')
    expect(isHistorico(order(LAST_YEAR_DECEMBER), janNow)).toBe(true)
  })

  it('is false for the current month', () => {
    expect(isHistorico(order(THIS_MONTH), NOW)).toBe(false)
  })

  it('is false for a Provisória order even in a past month', () => {
    expect(isHistorico(order(LAST_MONTH, true), NOW)).toBe(false)
  })

  it('is false when Provisoria is null but the date is current', () => {
    expect(isHistorico(order(THIS_MONTH, null), NOW)).toBe(false)
  })

  it('is false (safe default) for an invalid date', () => {
    expect(isHistorico(order('not-a-date'), NOW)).toBe(false)
  })
})

describe('orderEstado', () => {
  it('classifies a Provisória order as provisório regardless of month', () => {
    expect(orderEstado(order(LAST_MONTH, true), NOW)).toBe('provisorio')
  })

  it('classifies a past-month closed order as histórico', () => {
    expect(orderEstado(order(LAST_MONTH), NOW)).toBe('historico')
  })

  it('classifies a current-month closed order as atual', () => {
    expect(orderEstado(order(THIS_MONTH), NOW)).toBe('atual')
  })
})

describe('LOCKED_CARACTERIZACAO', () => {
  it('contains the characterization fields, including DT_Order (no escape via date move)', () => {
    expect(isLockedCaracterizacaoField('DT_Order')).toBe(true)
    expect(isLockedCaracterizacaoField('Sell_Price')).toBe(true)
    expect(isLockedCaracterizacaoField('ID_Tp_Revenue')).toBe(false)
    expect(isLockedCaracterizacaoField('ID_Area')).toBe(true)
  })

  it('does not lock non-characterization fields', () => {
    expect(isLockedCaracterizacaoField('Obs')).toBe(false)
    expect(isLockedCaracterizacaoField('PO_Cliente')).toBe(false)
    expect(isLockedCaracterizacaoField('Encomenda_Cli_PHC')).toBe(false)
  })

  it('is non-empty', () => {
    expect(LOCKED_CARACTERIZACAO.size).toBeGreaterThan(0)
  })
})

describe('canEditField', () => {
  it('viewer is read-only everywhere', () => {
    expect(canEditField(order(THIS_MONTH), 'Sell_Price', 'viewer', NOW)).toBe(false)
    expect(canEditField(order(LAST_MONTH), 'Obs', 'viewer', NOW)).toBe(false)
    expect(canEditField(order(LAST_MONTH, true), 'Sell_Price', 'viewer', NOW)).toBe(false)
  })

  it('admin can edit everything everywhere', () => {
    expect(canEditField(order(LAST_MONTH), 'Sell_Price', 'admin', NOW)).toBe(true)
    expect(canEditField(order(LAST_MONTH, true), 'DT_Order', 'admin', NOW)).toBe(true)
  })

  it('editor can edit a locked characterization field when atual', () => {
    expect(canEditField(order(THIS_MONTH), 'Sell_Price', 'editor', NOW)).toBe(true)
  })

  it('editor can edit a locked characterization field when provisória', () => {
    expect(canEditField(order(LAST_MONTH, true), 'Sell_Price', 'editor', NOW)).toBe(true)
  })

  it('editor cannot edit characterization fields when histórico', () => {
    expect(canEditField(order(LAST_MONTH), 'Sell_Price', 'editor', NOW)).toBe(false)
    expect(canEditField(order(LAST_MONTH), 'ID_Area', 'editor', NOW)).toBe(false)
    expect(canEditField(order(LAST_MONTH), 'DT_Order', 'editor', NOW)).toBe(false)
    expect(canEditField(order(LAST_MONTH), 'ID_Tp_Warranty', 'editor', NOW)).toBe(false)
  })

  it('editor can edit Revenue, Faturação and Observações when histórico', () => {
    expect(canEditField(order(LAST_MONTH), 'Warranty_Reserve', 'editor', NOW)).toBe(false)
    expect(canEditField(order(LAST_MONTH), 'ID_Tp_Revenue', 'editor', NOW)).toBe(true)
    expect(canEditField(order(LAST_MONTH), 'Obs', 'editor', NOW)).toBe(true)
    expect(canEditField(order(LAST_MONTH), 'PO_Cliente', 'editor', NOW)).toBe(true)
  })
})
