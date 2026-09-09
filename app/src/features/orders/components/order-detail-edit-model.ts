import type { Order } from '@/domain/models/order'
import type { OrderUpdatePatch } from '@/services/contracts/orders.repository'
import {
  areas,
  instrumentos,
  orderTypes,
  produtos,
  revenueTypes,
  tipos,
  warrantyTypes,
  type ReferenceOption,
} from '@/fixtures/reference-data'

export type FieldKind =
  'text' | 'number' | 'date' | 'select-str' | 'select-num' | 'boolean' | 'client'

export interface FieldDef {
  key: keyof OrderUpdatePatch
  label: string
  kind: FieldKind
  options?: readonly ReferenceOption[]
}

export const CARACTERIZACAO_FIELDS: readonly FieldDef[] = [
  { key: 'DT_Order', label: 'Order Date', kind: 'date' },
  { key: 'ID_Tp_Order', label: 'Order Type', kind: 'select-str', options: orderTypes },
  { key: 'Encomenda_Cli_PHC', label: 'SAP Order Number', kind: 'text' },
  { key: 'ID_Client', label: 'Client', kind: 'client' },
  { key: 'ID_Area', label: 'Area', kind: 'select-str', options: areas },
  { key: 'ID_Tipo', label: 'Type', kind: 'select-str', options: tipos },
  { key: 'ID_Produto', label: 'Product', kind: 'select-num', options: produtos },
  { key: 'ID_Instrumento', label: 'Instrument', kind: 'select-num', options: instrumentos },
  { key: 'ID_Tp_Warranty', label: 'Warranty', kind: 'select-num', options: warrantyTypes },
  { key: 'Warranty_DT_Inicio', label: 'Warranty Start', kind: 'date' },
  { key: 'ID_Tp_Revenue', label: 'Revenue Type', kind: 'select-num', options: revenueTypes },
]

export const REVENUE_FIELDS: readonly FieldDef[] = [
  { key: 'Sell_Price', label: 'Sell Price', kind: 'number' },
  { key: 'Warranty_Reserve', label: 'Warranty Reserve', kind: 'number' },
]

export const FATURACAO_FIELDS: readonly FieldDef[] = [
  { key: 'Orc_Proposta', label: 'Quote / Proposal', kind: 'text' },
  { key: 'PO_Cliente', label: 'Customer PO', kind: 'text' },
  { key: 'Email', label: 'Order email', kind: 'text' },
  { key: 'Contacto', label: 'Customer Contact', kind: 'text' },
]

export const KIT_FIELDS: readonly FieldDef[] = [
  { key: 'Kit', label: 'Kit', kind: 'boolean' },
  { key: 'Kit_Amount', label: 'Kit Amount', kind: 'number' },
]

export const ALL_EDITABLE_FIELDS: readonly FieldDef[] = [
  ...CARACTERIZACAO_FIELDS,
  ...REVENUE_FIELDS,
  ...FATURACAO_FIELDS,
  ...KIT_FIELDS,
  { key: 'Obs', label: 'Notes', kind: 'text' },
]

export type Draft = Record<string, string>

export function optionLabel(
  options: readonly ReferenceOption[],
  id: string | number | null | undefined,
): string | null {
  if (id === null || id === undefined) return null
  const match = options.find((o) => String(o.id) === String(id))
  return match ? match.label : null
}

export function mergeSaved<T extends ReferenceOption>(
  filtered: readonly T[] | undefined,
  heldId: string | number | null | undefined,
  full: readonly T[],
): T[] {
  const list = filtered ? [...filtered] : []
  if (heldId != null && heldId !== '' && !list.some((o) => String(o.id) === String(heldId))) {
    const held = full.find((o) => String(o.id) === String(heldId))
    if (held) list.unshift(held)
  }
  return list
}

export function seedDraft(order: Order): Draft {
  const draft: Draft = {}
  for (const def of ALL_EDITABLE_FIELDS) {
    const v = order[def.key]
    if (def.kind === 'boolean') draft[def.key] = v === true ? 'true' : 'false'
    else if (def.kind === 'date') draft[def.key] = v ? String(v).slice(0, 10) : ''
    else draft[def.key] = v == null ? '' : String(v)
  }
  return draft
}

export function parseValue(def: FieldDef, raw: string): unknown {
  if (def.kind === 'boolean') return raw === 'true'
  if (raw === '') return null
  if (def.kind === 'number' || def.kind === 'select-num' || def.kind === 'client') {
    const n = Number(raw)
    return Number.isNaN(n) ? null : n
  }
  if (def.key === 'Email') return raw.replace(/;/g, ',')
  return raw
}

export function buildPatch(draft: Draft, order: Order): OrderUpdatePatch {
  const patch: Partial<OrderUpdatePatch> = {}
  for (const def of ALL_EDITABLE_FIELDS) {
    const parsed = parseValue(def, draft[def.key] ?? '')
    const current = order[def.key] ?? null
    const differs =
      def.kind === 'date'
        ? parsed !== (current == null ? null : String(current).slice(0, 10))
        : parsed !== current && !(parsed == null && current == null)
    if (differs) {
      ;(patch as Record<string, unknown>)[def.key] = parsed
    }
  }
  return patch
}
