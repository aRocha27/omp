/**
 * Order edit policy — the "bloqueio de caracterização após fecho do mês" rule.
 *
 * A characterization field is locked for an Editor when the order sits in a past
 * month (year+month comparison, NOT month-only) AND the order is not Provisória.
 * Admins override; Viewers are read-only everywhere; Provisória orders stay fully
 * editable regardless of the month.
 *
 * Pure and deterministic: takes the order and the role, returns booleans. The UI
 * uses these to disable inputs; the backend re-implements the same check for
 * defense-in-depth (the browser is never trusted).
 */
import type { Order } from '@/domain/models/order'
import type { RoleLike } from '@/domain/models/user'

export type OrderEstado = 'provisorio' | 'historico' | 'atual'

/**
 * Caracterização fields an Editor cannot touch once the order's month has closed.
 * The DT_Order is included so an Editor cannot move a histórico order into the
 * current month to escape the lock.
 */
export const LOCKED_CARACTERIZACAO: ReadonlySet<keyof Order> = new Set<keyof Order>([
  'DT_Order',
  'ID_Tp_Order',
  'ID_Client',
  'ID_Area',
  'ID_Tipo',
  'ID_Produto',
  'ID_Instrumento',
  'Sell_Price',
  'ID_Tp_Warranty',
  'Warranty_Reserve',
  'Warranty_DT_Inicio',
])

/** First instant of the given month, in UTC (TIMEZONE.md — everything is UTC). */
export function startOfCurrentMonthUTC(today: Date = new Date()): Date {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
}

/**
 * True when the order date falls before the first day of the current month AND the
 * order is not Provisória. Year+month comparison (Dez/2025 vs Jan/2026 = past),
 * never month-only. A null/invalid date is treated as not-histórico (safe default:
 * editable) so a bad row never bricks the detail page.
 */
export function isHistorico(order: Pick<Order, 'DT_Order' | 'Provisoria'>, today: Date = new Date()): boolean {
  if (order.Provisoria === true) return false
  const orderDate = new Date(order.DT_Order)
  if (Number.isNaN(orderDate.getTime())) return false
  return orderDate < startOfCurrentMonthUTC(today)
}

/** Classify an order for display: Provisória first, then histórico, otherwise atual. */
export function orderEstado(order: Pick<Order, 'DT_Order' | 'Provisoria'>, today: Date = new Date()): OrderEstado {
  if (order.Provisoria === true) return 'provisorio'
  return isHistorico(order, today) ? 'historico' : 'atual'
}

/** True for the caracterização fields locked for an Editor in a histórico order. */
export function isLockedCaracterizacaoField(field: keyof Order): boolean {
  return LOCKED_CARACTERIZACAO.has(field)
}

/**
 * Whether a given field may be edited by a role on this order.
 *
 * - viewer → never (read-only everywhere)
 * - admin  → always
 * - editor → blocked only on caracterização fields of a histórico order
 */
export function canEditField(
  order: Pick<Order, 'DT_Order' | 'Provisoria'>,
  field: keyof Order,
  role: RoleLike,
  today: Date = new Date(),
): boolean {
  if (role === 'viewer') return false
  if (role === 'admin') return true
  // editor
  if (isHistorico(order, today) && isLockedCaracterizacaoField(field)) return false
  return true
}
