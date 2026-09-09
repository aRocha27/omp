/**
 * Order edit policy — the "bloqueio de caracterização após fecho do mês" rule.
 *
 * A characterization field is locked for an Editor when the order sits in a past
 * month (year+month comparison, NOT month-only) AND the order is not Provisional.
 * Admins override; Viewers are read-only everywhere; Provisional orders stay fully
 * editable regardless of the month.
 *
 * Pure and deterministic: takes the order and the role, returns booleans. The UI
 * uses these to disable inputs; the backend re-implements the same check for
 * defense-in-depth (the browser is never trusted).
 */
import type { Order } from '@/domain/models/order'
import type { RoleLike } from '@/domain/models/user'

export type OrderEstado = 'provisorio' | 'historico' | 'current'

/**
 * Caracterização fields an Editor cannot touch once the order's month has closed.
 * The DT_Order is included so an Editor cannot move a historical order into the
 * current month to escape the lock.
 */
export const LOCKED_CARACTERIZACAO: ReadonlySet<keyof Order> = new Set<keyof Order>([
  'DT_Order',
  'ID_Tp_Order',
  'Encomenda_Cli_PHC',
  'ID_Client',
  'ID_Area',
  'ID_Tipo',
  'ID_Produto',
  'ID_Instrumento',
  'Sell_Price',
  'ID_Tp_Warranty',
  'Warranty_Reserve',
])

/**
 * Faturação (Quote/Proposal, Customer PO, Email, Contact) fields. The user
 * asked that these stay unlocked for everyone regardless of the time/month
 * lock that applies to caracterização fields, so they are exempt from the
 * historical-order lock.
 */
export const FATURACAO_FIELDS: ReadonlySet<keyof Order> = new Set<keyof Order>([
  'Orc_Proposta',
  'PO_Cliente',
  'Email',
  'Contacto',
])

/** First instant of the given month, in UTC (TIMEZONE.md — everything is UTC). */
export function startOfCurrentMonthUTC(today: Date = new Date()): Date {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
}

/**
 * True when the order date falls before the first day of the current month AND the
 * order is not Provisional. Year+month comparison (Dec/2025 vs Jan/2026 = past),
 * never month-only. A null/invalid date is treated as not-historical (safe default:
 * editable) so a bad row never bricks the detail page.
 */
export function isHistorico(order: Pick<Order, 'DT_Order' | 'Provisoria'>, today: Date = new Date()): boolean {
  if (order.Provisoria === true) return false
  const orderDate = new Date(order.DT_Order)
  if (Number.isNaN(orderDate.getTime())) return false
  return orderDate < startOfCurrentMonthUTC(today)
}

/** Classify an order for display: Provisional first, then historical, otherwise current. */
export function orderEstado(order: Pick<Order, 'DT_Order' | 'Provisoria'>, today: Date = new Date()): OrderEstado {
  if (order.Provisoria === true) return 'provisorio'
  return isHistorico(order, today) ? 'historico' : 'current'
}

/** True for the caracterização fields locked for an Editor in a historical order. */
export function isLockedCaracterizacaoField(field: keyof Order): boolean {
  return LOCKED_CARACTERIZACAO.has(field)
}

export function isWarrantyStartLocked(
  order: Pick<Order, 'Warranty_DT_Inicio'>,
  today: Date = new Date(),
): boolean {
  if (!order.Warranty_DT_Inicio) return false
  const warrantyStart = new Date(order.Warranty_DT_Inicio)
  if (Number.isNaN(warrantyStart.getTime())) return false
  return warrantyStart < startOfCurrentMonthUTC(today)
}

/**
 * Whether the financial sub-tables (recognitions + invoicing documents) accept
 * new rows from `role` on this order.
 *
 * - viewer → never (read-only everywhere)
 * - editor / user / admin → always
 *
 * The user explicitly asked that "the USER may Add recognition and Invoice"
 * even after the month has closed; the month lock only applies to
 * editing/deleting existing rows (see {@link canEditFinancial}). Provisional
 * orders are always editable, so the helper short-circuits to `true` there
 * for symmetry with the other policy checks.
 */
export function canAddFinancial(role: RoleLike): boolean {
  if (role === 'viewer') return false
  return true
}

/**
 * Whether an existing financial row (recognition or invoicing document) may be
 * edited or deleted by `role` on this order.
 *
 * - viewer → never (read-only everywhere)
 * - admin  → always (admin override)
 * - editor / user → allowed while the order's month is current or future
 *   (`isHistorico` is false). Once the month has closed the row becomes
 *   admin-only — the rule the user asked for: "the USER can only change the
 *   Recognition or Invoice if its inside the month, after a month has passed
 *   its locked of chaning and only the ADMIN may change that data". Adding new
 *   rows is intentionally NOT gated here — see {@link canAddFinancial}.
 *
 * Provisional orders stay fully editable regardless of the month (consistent
 * with the existing caracterização lock).
 */
export function canEditFinancial(
  order: Pick<Order, 'DT_Order' | 'Provisoria'>,
  role: RoleLike,
  today: Date = new Date(),
): boolean {
  if (role === 'viewer') return false
  if (role === 'admin') return true
  return !isHistorico(order, today)
}

/**
 * Whether a given field may be edited by a role on this order.
 *
 * - viewer  → never (read-only everywhere)
 * - admin   → always
 * - user    → may edit ONLY Warranty (`ID_Tp_Warranty`) and Warranty Start
 *             (`Warranty_DT_Inicio`), regardless of order type, month, or
 *             whether the value is already populated. Every other field is locked.
 * - editor  → blocked only on caracterização fields of a historical order;
 *             Warranty Start remains subject to its own date rule.
 */
export function canEditField(
  order: Pick<Order, 'DT_Order' | 'Provisoria' | 'ID_Tp_Order' | 'ID_Tp_Warranty' | 'Warranty_DT_Inicio'>,
  field: keyof Order,
  role: RoleLike,
  today: Date = new Date(),
): boolean {
  if (role === 'viewer') return false
  if (role === 'admin') return true
  if (FATURACAO_FIELDS.has(field)) return true
  if (role === 'user') {
    return field === 'ID_Tp_Warranty' || field === 'Warranty_DT_Inicio'
  }
  if (order.ID_Tp_Order !== 'C') return true
  if (field === 'Warranty_DT_Inicio') return !isWarrantyStartLocked(order, today)
  if (field === 'ID_Tp_Warranty' && order.ID_Tp_Warranty == null) return true
  if (isHistorico(order, today) && isLockedCaracterizacaoField(field)) return false
  return true
}
