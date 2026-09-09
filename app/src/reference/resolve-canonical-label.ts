/**
 * Centralised "canonical-label" fallback for Orders.
 *
 * The Orders list/detail query already joins `V_Order_List` server-side and
 * carries human-readable labels as `*_Label` columns (e.g. `Area_Label`,
 * `Tp_Order_Label`). When those server-resolved labels are absent — for
 * mock data, for orders that no longer match the view, or when an upstream
 * join dropped the row — we fall back to the local fixture-driven resolvers
 * in `@/features/orders/components/reference-labels`.
 *
 * This helper exists so the same three-line ladder is NOT duplicated in
 * every table cell, every export column, and every page-level header. Adding
 * a new reference-data field means updating this file and the matching
 * resolver in `reference-labels.ts` — not hunting through three components.
 *
 * Returning `null` for a non-null FK id is intentional: a missing label is
 * a mapping/data-integrity signal and must surface as an empty slot, never
 * as the raw id (which would hide the problem).
 */
import {
  areaLabel,
  instrumentoLabel,
  orderTypeLabel,
  produtoLabel,
  reconhecimentoLabel,
  revenueLabel,
  tipoLabel,
  warrantyLabel,
} from '@/features/orders/components/reference-labels'
import type { Order, OrderSummary } from '@/domain/models/order'

type AnyOrder = Order | OrderSummary

function pick<T>(serverValue: T | null | undefined, fallback: () => T | null): T | null {
  if (serverValue !== null && serverValue !== undefined) return serverValue
  return fallback()
}

function toCell<T>(value: T | null | undefined, emptyValue: string): string {
  if (value === null || value === undefined) return emptyValue
  const s = String(value)
  return s.length > 0 ? s : emptyValue
}

export function resolveOrderTypeLabel(order: AnyOrder): string {
  return toCell(pick(order.Tp_Order_Label, () => orderTypeLabel(order.ID_Tp_Order)), '—')
}

export function resolveAreaLabel(order: AnyOrder): string {
  return toCell(pick(order.Area_Label, () => areaLabel(order.ID_Area)), '—')
}

export function resolveTipoLabel(order: AnyOrder): string {
  return toCell(pick(order.Tipo_Label, () => tipoLabel(order.ID_Tipo)), '—')
}

export function resolveProdutoLabel(order: AnyOrder): string {
  return toCell(pick(order.Produto_Label, () => produtoLabel(order.ID_Produto)), '—')
}

export function resolveInstrumentoLabel(order: AnyOrder): string {
  return toCell(pick(order.Instrumento_Label, () => instrumentoLabel(order.ID_Instrumento)), '—')
}

export function resolveWarrantyLabel(order: AnyOrder): string {
  return toCell(pick(order.Tp_Warranty_Label, () => warrantyLabel(order.ID_Tp_Warranty)), '—')
}

export function resolveRevenueLabel(order: AnyOrder): string {
  return toCell(pick(order.Tp_Revenue_Label, () => revenueLabel(order.ID_Tp_Revenue)), '—')
}

/** Cell value used by `orders-export.ts` — empty string instead of em-dash. */
export const resolveOrderTypeExport = (order: AnyOrder): string =>
  toCell(pick(order.Tp_Order_Label, () => orderTypeLabel(order.ID_Tp_Order)), '')

export const resolveAreaExport = (order: AnyOrder): string =>
  toCell(pick(order.Area_Label, () => areaLabel(order.ID_Area)), '')

export const resolveTipoExport = (order: AnyOrder): string =>
  toCell(pick(order.Tipo_Label, () => tipoLabel(order.ID_Tipo)), '')

export const resolveProdutoExport = (order: AnyOrder): string =>
  toCell(pick(order.Produto_Label, () => produtoLabel(order.ID_Produto)), '')

export const resolveInstrumentoExport = (order: AnyOrder): string =>
  toCell(pick(order.Instrumento_Label, () => instrumentoLabel(order.ID_Instrumento)), '')

export const resolveWarrantyExport = (order: AnyOrder): string =>
  toCell(pick(order.Tp_Warranty_Label, () => warrantyLabel(order.ID_Tp_Warranty)), '')

export const resolveRevenueExport = (order: AnyOrder): string =>
  toCell(pick(order.Tp_Revenue_Label, () => revenueLabel(order.ID_Tp_Revenue)), '')

/**
 * Free-standing helper for sub-tables (Reconhecimento) that don't carry a
 * pre-resolved label column. Returns em-dash on null.
 */
export function resolveReconhecimentoLabel(code: string | null | undefined): string {
  return toCell(reconhecimentoLabel(code), '—')
}