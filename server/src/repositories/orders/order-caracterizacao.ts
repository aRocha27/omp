/**
 * Pure domain predicates for the Orders Caracterização lock.
 *
 * These functions implement the "bloqueio de caracterização após fecho do
 * mês" rule that decides which Order fields an editor (vs. an admin) may
 * patch on a histórico order. They are deliberately *pure* — no SQL, no
 * mssql pool — so they can be reused by the route layer
 * (`routes/orders.ts`) without inverting the layering.
 *
 * Moved out of `db.ts` so the data layer doesn't have to own domain
 * policy. db.ts re-exports the same names to keep existing imports
 * working during the decomposition.
 */
import type { OrderDetailRow } from '../../types/index.js'

/**
 * Whitelist of `Order` columns an editor cannot patch on a histórico
 * Client (`ID_Tp_Order === 'C'`) order. Two fields get explicit carve-
 * outs at the call site: `Warranty_DT_Inicio` (separate
 * `isWarrantyStartLocked` rule) and `ID_Tp_Warranty` (user/editor flow
 * for filling a NULL).
 */
export const LOCKED_CARACTERIZACAO_FIELDS = new Set([
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

/** First instant of the current UTC month — the boundary that separates
 *  current-month orders (still editable) from histórico ones (locked). */
export function startOfCurrentMonthUTC(today: Date = new Date()): Date {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
}

/** An order is histórico when its `DT_Order` falls in a strictly earlier
 *  month than `today` (year+month compare, UTC). Provisional
 *  (`Provisoria === true`) orders are NEVER histórico — they stay
 *  editable until finalized. */
export function isHistoricoRow(row: OrderDetailRow, today: Date = new Date()): boolean {
  if (row.Provisoria === true) return false
  const orderDate = new Date(row.DT_Order)
  if (Number.isNaN(orderDate.getTime())) return false
  const monthStart = startOfCurrentMonthUTC(today)
  return orderDate.getTime() < monthStart.getTime()
}

export function isLockedCaracterizacaoField(field: string): boolean {
  return LOCKED_CARACTERIZACAO_FIELDS.has(field)
}

/** `Warranty_DT_Inicio` is locked only once its own month has passed. A
 *  warranty start in the current or a future month stays editable. */
export function isWarrantyStartLocked(
  row: Pick<OrderDetailRow, 'Warranty_DT_Inicio'>,
  today: Date = new Date(),
): boolean {
  if (!row.Warranty_DT_Inicio) return false
  const warrantyStart = new Date(row.Warranty_DT_Inicio)
  if (Number.isNaN(warrantyStart.getTime())) return false
  return warrantyStart.getTime() < startOfCurrentMonthUTC(today).getTime()
}