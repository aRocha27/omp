import { describe, expect, it } from 'vitest'
import type { Order } from '@/domain/models/order'
import {
  LOCKED_CARACTERIZACAO,
  canAddFinancial,
  canEditField,
  canEditFinancial,
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

  it('is false for a Provisional order even in a past month', () => {
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
  it('classifies a Provisional order as provisório regardless of month', () => {
    expect(orderEstado(order(LAST_MONTH, true), NOW)).toBe('provisorio')
  })

  it('classifies a past-month closed order as historical', () => {
    expect(orderEstado(order(LAST_MONTH), NOW)).toBe('historico')
  })

  it('classifies a current-month closed order as current', () => {
    expect(orderEstado(order(THIS_MONTH), NOW)).toBe('current')
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

  it('editor can edit a locked characterization field when current', () => {
    expect(canEditField(order(THIS_MONTH), 'Sell_Price', 'editor', NOW)).toBe(true)
  })

  it('editor can edit a locked characterization field when provisória', () => {
    expect(canEditField(order(LAST_MONTH, true), 'Sell_Price', 'editor', NOW)).toBe(true)
  })

  it('editor cannot edit characterization fields when historical', () => {
    expect(canEditField(order(LAST_MONTH), 'Sell_Price', 'editor', NOW)).toBe(false)
    expect(canEditField(order(LAST_MONTH), 'ID_Area', 'editor', NOW)).toBe(false)
    expect(canEditField(order(LAST_MONTH), 'DT_Order', 'editor', NOW)).toBe(false)
    expect(canEditField(order(LAST_MONTH), 'ID_Tp_Warranty', 'editor', NOW)).toBe(false)
  })

  it('editor can edit Revenue, Faturação and Observações when historical', () => {
    expect(canEditField(order(LAST_MONTH), 'Warranty_Reserve', 'editor', NOW)).toBe(false)
    expect(canEditField(order(LAST_MONTH), 'ID_Tp_Revenue', 'editor', NOW)).toBe(true)
    expect(canEditField(order(LAST_MONTH), 'Obs', 'editor', NOW)).toBe(true)
    expect(canEditField(order(LAST_MONTH), 'PO_Cliente', 'editor', NOW)).toBe(true)
  })
})

describe('canAddFinancial', () => {
  it('viewer can never add a financial row', () => {
    expect(canAddFinancial('viewer')).toBe(false)
  })

  it('editor / user / admin can always add a financial row, regardless of the order month', () => {
    // The user explicitly asked that adding stays open after the month has closed
    // — only editing/deleting existing rows is gated. The month is irrelevant here.
    expect(canAddFinancial('editor')).toBe(true)
    expect(canAddFinancial('user')).toBe(true)
    expect(canAddFinancial('admin')).toBe(true)
  })
})

describe('canEditFinancial', () => {
  it('viewer can never edit a financial row', () => {
    expect(canEditFinancial(order(THIS_MONTH), 'viewer', NOW)).toBe(false)
    expect(canEditFinancial(order(LAST_MONTH), 'viewer', NOW)).toBe(false)
    expect(canEditFinancial(order(LAST_MONTH, true), 'viewer', NOW)).toBe(false)
  })

  it('admin can always edit financial rows, even on a histórico order', () => {
    expect(canEditFinancial(order(THIS_MONTH), 'admin', NOW)).toBe(true)
    expect(canEditFinancial(order(LAST_MONTH), 'admin', NOW)).toBe(true)
  })

  it('editor / user can edit financial rows in the current month', () => {
    expect(canEditFinancial(order(THIS_MONTH), 'editor', NOW)).toBe(true)
    expect(canEditFinancial(order(THIS_MONTH), 'user', NOW)).toBe(true)
  })

  it('editor / user cannot edit financial rows once the order\'s month has closed', () => {
    expect(canEditFinancial(order(LAST_MONTH), 'editor', NOW)).toBe(false)
    expect(canEditFinancial(order(LAST_MONTH), 'user', NOW)).toBe(false)
  })

  it('editor / user can still edit a Provisional order even when past the month', () => {
    expect(canEditFinancial(order(LAST_MONTH, true), 'editor', NOW)).toBe(true)
    expect(canEditFinancial(order(LAST_MONTH, true), 'user', NOW)).toBe(true)
  })

  it('a future-month order is editable for editor / user (not yet histórico)', () => {
    const future = '2026-12-01T00:00:00Z'
    expect(canEditFinancial(order(future), 'editor', NOW)).toBe(true)
    expect(canEditFinancial(order(future), 'user', NOW)).toBe(true)
  })
})
