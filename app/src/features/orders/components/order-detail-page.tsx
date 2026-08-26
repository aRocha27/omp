import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Clock,
  FileText,
  Lock,
  Mail,
  Package,
  Pencil,
  Plus,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Trash2,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useOrder } from '@/features/orders/api/use-order'
import { useUpdateOrder } from '@/features/orders/api/use-update-order'
import { useReconhecimentos } from '@/features/orders/api/use-reconhecimentos'
import {
  useDocumentoFaturacao,
  useDocumentoFaturacaoTypes,
} from '@/features/orders/api/use-documento-faturacao'
import { useUpdateReconhecimento } from '@/features/orders/api/use-update-reconhecimento'
import { useDeleteReconhecimento } from '@/features/orders/api/use-delete-reconhecimento'
import { usePropagateReconhecimento } from '@/features/orders/api/use-propagate-reconhecimento'
import { useUpdateDocumentoFaturacao } from '@/features/orders/api/use-update-documento-faturacao'
import { useDeleteDocumentoFaturacao } from '@/features/orders/api/use-delete-documento-faturacao'
import {
  useAddKitConsumable,
  useDeleteKitConsumable,
  useKitConsumables,
  useUpdateKitConsumable,
} from '@/features/orders/api/use-kit-consumables'
import { useCurrentUser, useRoleSwitcher } from '@/app/providers/user-provider'
import { useRepositories } from '@/app/providers/repository-provider'
import { useAreas } from '@/features/orders/api/use-areas'
import { useProdutos } from '@/features/orders/api/use-produtos'
import { useInstrumentos } from '@/features/orders/api/use-instrumentos'
import { resolveClientName } from '@/fixtures/orders'
import { formatOrderDate, formatPrice } from '@/utils/format'
import { recognitionTotals, reconhecimentoEstado } from '@/domain/rules/recognition'
import { planMaintenancePropagation, planWarrantyPropagation } from '@/domain/rules/propagation'
import type { Order } from '@/domain/models/order'
import type { OrderUpdatePatch } from '@/services/contracts/orders.repository'
import type { RoleLike } from '@/domain/models/user'
import type { Reconhecimento } from '@/domain/models/reconhecimento'
import type { KitConsumable } from '@/domain/models/kit-consumable'
import type { DocumentoFaturacao } from '@/domain/models/documento-faturacao'
import type { DocumentoFaturacaoType } from '@/services/contracts/documento-faturacao.repository'
import {
  canAddFinancial,
  canEditField,
  canEditFinancial,
  isHistorico,
  orderEstado,
  type OrderEstado,
} from '@/domain/orders/order-policy'
import {
  areas,
  instrumentos,
  orderTypes,
  produtos,
  revenueTypes,
  tipos,
  tpReconhecimentos,
  warrantyTypes,
  WARRANTY_RECONHECIMENTO_CODES,
  type ReferenceOption,
} from '@/fixtures/reference-data'
import { reconhecimentoLabel } from '@/features/orders/components/reference-labels'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, type TabItem } from '@/components/ui/tabs'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

/** Em-dash fallback for any null/empty display value. */
const DASH = '—'

function displayText(v: string | null | undefined): string {
  return v && v.length > 0 ? v : DASH
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Editable field definitions                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

type FieldKind = 'text' | 'number' | 'date' | 'select-str' | 'select-num' | 'boolean'

interface FieldDef {
  key: keyof OrderUpdatePatch
  label: string
  kind: FieldKind
  options?: readonly ReferenceOption[]
}

/** Caracterização block — the order-classification fields locked after month close. */
const CARACTERIZACAO_FIELDS: readonly FieldDef[] = [
  { key: 'DT_Order', label: 'Order Date', kind: 'date' },
  { key: 'ID_Tp_Order', label: 'Order Type', kind: 'select-str', options: orderTypes },
  { key: 'ID_Client', label: 'Client', kind: 'number' },
  { key: 'ID_Area', label: 'Area', kind: 'select-str', options: areas },
  { key: 'ID_Tipo', label: 'Kind', kind: 'select-str', options: tipos },
  { key: 'ID_Produto', label: 'Product', kind: 'select-num', options: produtos },
  { key: 'ID_Instrumento', label: 'Instrument', kind: 'select-num', options: instrumentos },
  { key: 'ID_Tp_Warranty', label: 'Warranty', kind: 'select-num', options: warrantyTypes },
  { key: 'Warranty_DT_Inicio', label: 'Warranty Start', kind: 'date' },
  { key: 'ID_Tp_Revenue', label: 'Revenue Type', kind: 'select-num', options: revenueTypes },
]

/** Revenue tab — the financial values that drive recognition math. */
const REVENUE_FIELDS: readonly FieldDef[] = [
  { key: 'Sell_Price', label: 'Sell Price', kind: 'number' },
  { key: 'Warranty_Reserve', label: 'Warranty Reserve', kind: 'number' },
]

/** Invoicing tab — editable commercial references. */
const FATURACAO_FIELDS: readonly FieldDef[] = [
  { key: 'Orc_Proposta', label: 'Quote / Proposal', kind: 'text' },
  { key: 'PO_Cliente', label: 'Customer PO', kind: 'text' },
]

/** Kit block — the order's kit flag and budget. Not part of the month-locked
 *  caracterização set, so always editable for editor/admin. `Kit_Amount` is
 *  rendered in the Kit tab alongside the Balance and the Kit_Consumables sub-table;
 *  `Kit` is the caracterização checkbox that gates the tab's visibility. */
const KIT_FIELDS: readonly FieldDef[] = [
  { key: 'Kit', label: 'Kit', kind: 'boolean' },
  { key: 'Kit_Amount', label: 'Kit Amount', kind: 'number' },
]

/** Every field the edit draft tracks. Obs is rendered as a textarea but kept in
 *  the same draft so [Save] saves it in one round-trip. */
const ALL_EDITABLE_FIELDS: readonly FieldDef[] = [
  ...CARACTERIZACAO_FIELDS,
  ...REVENUE_FIELDS,
  ...FATURACAO_FIELDS,
  ...KIT_FIELDS,
  { key: 'Obs', label: 'Notes', kind: 'text' },
]

/** Draft values are stored as strings (form inputs are strings); parsed back to
 *  typed values when building the patch. */
type Draft = Record<string, string>

function optionLabel(
  options: readonly ReferenceOption[],
  id: string | number | null | undefined,
): string | null {
  if (id === null || id === undefined) return null
  const match = options.find((o) => String(o.id) === String(id))
  return match ? match.label : null
}

/**
 * Merge a parent-filtered option list with the currently-held child value.
 *
 * The cascade dropdowns show only the parent's children, but a legacy order may hold
 * a child id that no longer matches its parent (data drift). To avoid silently hiding
 * the saved value from the dropdown, the held id is prepended (from the full fixture
 * list) when it isn't already in the filtered set. New picks stay constrained to the
 * filtered children; the preserved row lets the editor see/keep the existing value.
 */
function mergeSaved<T extends ReferenceOption>(
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

/** Seed the draft from the order so each input shows its current value. */
function seedDraft(order: Order): Draft {
  const draft: Draft = {}
  for (const def of ALL_EDITABLE_FIELDS) {
    const v = order[def.key]
    if (def.kind === 'boolean') draft[def.key] = v === true ? 'true' : 'false'
    else if (def.kind === 'date') draft[def.key] = v ? String(v).slice(0, 10) : ''
    else draft[def.key] = v == null ? '' : String(v)
  }
  return draft
}

/** Parse a raw draft string back to the field's wire type. */
function parseValue(def: FieldDef, raw: string): unknown {
  if (def.kind === 'boolean') return raw === 'true'
  if (raw === '') return null
  if (def.kind === 'number' || def.kind === 'select-num') {
    const n = Number(raw)
    return Number.isNaN(n) ? null : n
  }
  return raw
}

/** Build a minimal patch — only fields whose parsed value differs from the order.
 *  Locked fields never differ (their inputs are disabled) so they are never sent,
 *  which keeps a histórico editor's update from tripping the backend field-lock. */
function buildPatch(draft: Draft, order: Order): OrderUpdatePatch {
  const patch: Partial<OrderUpdatePatch> = {}
  for (const def of ALL_EDITABLE_FIELDS) {
    const parsed = parseValue(def, draft[def.key] ?? '')
    const current = order[def.key] ?? null
    if (parsed !== current && !(parsed == null && current == null)) {
      ;(patch as Record<string, unknown>)[def.key] = parsed
    }
  }
  return patch
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Header badges                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

/** Derived invoicing status from the net invoiced total vs Sell Price.
 *  - net == Sell Price (within money epsilon) → Fully Invoiced
 *  - net > 0 (but below Sell Price)           → Partially Invoiced
 *  - net <= 0                                  → Not Invoiced
 *  The order-level `Facturado` flag is server-set; this is the display truth. */
export function invoicingStatus(
  netInvoiced: number,
  sellPrice: number | null | undefined,
): { tone: 'success' | 'warning' | 'neutral'; label: string } {
  if (sellPrice != null && sellPrice > 0 && Math.abs(netInvoiced - sellPrice) <= 0.005) {
    return { tone: 'success', label: 'Fully Invoiced' }
  }
  if (netInvoiced > 0) return { tone: 'warning', label: 'Partially Invoiced' }
  return { tone: 'neutral', label: 'Not Invoiced' }
}

function EstadoBadge({ estado }: { estado: OrderEstado }) {
  const map: Record<OrderEstado, { tone: 'neutral' | 'success' | 'warning'; label: string }> = {
    provisorio: { tone: 'warning', label: 'Provisional' },
    historico: { tone: 'neutral', label: 'Historical' },
    current: { tone: 'success', label: 'Current' },
  }
  const { tone, label } = map[estado]
  return <Badge tone={tone}>{label}</Badge>
}

function PermissaoBadge({ role }: { role: RoleLike }) {
  const map: Record<RoleLike, { tone: 'neutral' | 'success' | 'warning'; label: string }> = {
    user: { tone: 'success', label: 'USER' },
    viewer: { tone: 'neutral', label: 'Viewer' },
    editor: { tone: 'success', label: 'Editor' },
    admin: { tone: 'warning', label: 'ADMIN' },
  }
  const { tone, label } = map[role]
  return <Badge tone={tone}>{label}</Badge>
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Presentational building blocks                                              */
/* ────────────────────────────────────────────────────────────────────────── */

type MetricTone = 'blue' | 'green' | 'orange' | 'purple'

/** Soft icon-chip colours per tone, mapped onto the design tokens. */
const TONE_CHIP: Record<MetricTone, string> = {
  blue: 'bg-primary/10 text-primary',
  green: 'bg-success/10 text-success',
  orange: 'bg-warning/10 text-warning',
  purple: 'bg-violet/10 text-violet',
}

/** A read-only KPI card: icon chip + label + value. The label is its own span so
 *  `getByText('Sell Price')` resolves to exactly this element. `highlight` paints a
 *  green background when the metric has reached its target (req 6). */
function MetricCard({
  tone,
  icon: Icon,
  label,
  value,
  tag,
  highlight,
}: {
  tone: MetricTone
  icon: LucideIcon
  label: string
  value: ReactNode
  tag?: string
  highlight?: boolean
}) {
  return (
    <div
      data-highlight={highlight ? 'true' : undefined}
      className={`flex min-h-[66px] items-center gap-2.5 rounded-lg border px-3 py-2.5 ${
        highlight ? 'border-success/40 bg-success/15' : 'border-border bg-surface'
      }`}
    >
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${TONE_CHIP[tone]}`}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] text-foreground-muted">
          <span>{label}</span>
          {tag && (
            <span className="rounded-full bg-foreground/10 px-1.5 py-px text-[9px] text-foreground/60">
              {tag}
            </span>
          )}
        </div>
        <div className="mt-1 whitespace-nowrap text-base font-bold text-foreground">{value}</div>
      </div>
    </div>
  )
}

/** A labelled card section with an optional header action — the preview's
 *  `.card` / `.section` shell. Titles are non-heading elements (the page `<h1>`
 *  is the only heading) so role=heading stays unambiguous. */
function SectionCard({
  title,
  action,
  children,
  bodyClassName,
  className,
}: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  bodyClassName?: string
  className?: string
}) {
  return (
    <section
      className={`overflow-hidden rounded-lg border border-border bg-surface shadow-sm ${className ?? ''}`}
    >
      {title && (
        <div className="flex h-9 items-center justify-between border-b border-border px-2.5 text-[11px] font-extrabold text-foreground/80">
          <span>{title}</span>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

/** The view-mode display value for a field. */
function viewValue(def: FieldDef, order: Order): ReactNode {
  const v = order[def.key]
  if (def.kind === 'boolean') return v === true ? 'Yes' : 'No'
  if (def.kind === 'select-str' || def.kind === 'select-num') {
    return displayText(optionLabel(def.options!, v as string | number | null))
  }
  if (def.key === 'ID_Client') {
    return displayText(order.Client_Name ?? resolveClientName(order.ID_Client))
  }
  if (
    def.key === 'Sell_Price' ||
    def.key === 'Warranty_Reserve' ||
    def.key === 'Kit_Amount'
  ) {
    return formatPrice(v as number | null)
  }
  if (def.kind === 'date') return formatOrderDate(v as string | null)
  return displayText(v as string | null)
}

/** The edit-mode control for a field. */
function FieldControl({
  def,
  value,
  disabled,
  onChange,
  optionsOverride,
}: {
  def: FieldDef
  value: string
  disabled: boolean
  onChange: (v: string) => void
  // When set, the select renders these options instead of `def.options` — used by
  // the Área/Produto/Instrumento cascade to show only the parent-filtered children.
  optionsOverride?: readonly ReferenceOption[]
}) {
  const common = {
    value,
    disabled,
    'aria-label': def.label,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange(e.target.value),
  }
  if (def.kind === 'boolean') {
    return (
      <Checkbox
        checked={value === 'true'}
        disabled={disabled}
        aria-label={def.label}
        onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
      />
    )
  }
  if (def.kind === 'select-str' || def.kind === 'select-num') {
    const options = optionsOverride ?? def.options!
    return (
      <Select {...common}>
        <option value="">—</option>
        {options.map((o) => (
          <option key={String(o.id)} value={String(o.id)}>
            {o.label}
          </option>
        ))}
      </Select>
    )
  }
  if (def.kind === 'number') return <Input type="number" {...common} />
  if (def.kind === 'date') {
    const dateValue = typeof value === 'string' && value ? value : null
    return (
      <DatePicker
        aria-label={def.label}
        value={dateValue}
        disabled={disabled}
        onChange={(next) => onChange(next ?? '')}
      />
    )
  }
  return <Input type="text" {...common} />
}

/** A small lock glyph shown beside a field label when the role can't edit it.
 *  The aria-label is pinned by the test suite. */
function LockIcon() {
  return (
    <Lock
      className="size-3 shrink-0 text-foreground/40"
      aria-label="Field locked (month closed)"
    />
  )
}

/** A caracterização form-row: label (fixed gutter) + value/control, horizontal. */
function CaracterizacaoRow({
  def,
  order,
  editing,
  role,
  value,
  onChange,
  optionsOverride,
}: {
  def: FieldDef
  order: Order
  editing: boolean
  role: RoleLike
  value: string
  onChange: (v: string) => void
  optionsOverride?: readonly ReferenceOption[]
}) {
  const locked = editing && !canEditField(order, def.key, role)
  return (
    <div className="grid grid-cols-[130px_1fr] items-center gap-2 px-2.5 py-1.5">
      <dt className="flex items-center gap-1 text-[10px] text-foreground-muted">
        <span>{def.label}</span>
        {locked && <LockIcon />}
      </dt>
      <dd className="min-w-0 text-[11px] text-foreground">
        {editing ? (
          <FieldControl
            def={def}
            value={value}
            disabled={locked}
            onChange={onChange}
            optionsOverride={optionsOverride}
          />
        ) : (
          viewValue(def, order)
        )}
      </dd>
    </div>
  )
}

/** A read-only caracterização row (fields that are never edited here, e.g. ID Order). */
function ReadOnlyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-center gap-2 px-2.5 py-1.5">
      <dt className="text-[10px] text-foreground-muted">{label}</dt>
      <dd className="min-w-0 text-[11px] font-medium text-foreground">{children}</dd>
    </div>
  )
}

/** A read-only contact row (bordered). */
function ContactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2 border-t border-border/60 px-2.5 py-1.5 text-[10px]">
      <span className="text-foreground-muted">{label}</span>
      <span className="font-medium text-foreground">{children}</span>
    </div>
  )
}

/** A revenue KPI that flips between a metric card (view) and a labelled input
 *  (edit), keeping the icon/label chrome so the grid doesn't reflow. */
function EditableMetric({
  def,
  order,
  editing,
  role,
  value,
  onChange,
  tone,
  icon: Icon,
  tag,
}: {
  def: FieldDef
  order: Order
  editing: boolean
  role: RoleLike
  value: string
  onChange: (v: string) => void
  tone: MetricTone
  icon: LucideIcon
  tag?: string
}) {
  const locked = editing && !canEditField(order, def.key, role)
  return (
    <div className="flex min-h-[66px] items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5">
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${TONE_CHIP[tone]}`}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] text-foreground-muted">
          <span>{def.label}</span>
          {tag && (
            <span className="rounded-full bg-foreground/10 px-1.5 py-px text-[9px] text-foreground/60">
              {tag}
            </span>
          )}
          {locked && <LockIcon />}
        </div>
        <div className="mt-1">
          {editing ? (
            <FieldControl def={def} value={value} disabled={locked} onChange={onChange} />
          ) : (
            <div className="whitespace-nowrap text-base font-bold text-foreground">
              {viewValue(def, order)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** A billing-grid cell that's read-only in view mode and a labelled input in edit. */
function BillingFieldEditable({
  def,
  order,
  editing,
  value,
  onChange,
}: {
  def: FieldDef
  order: Order
  editing: boolean
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="min-h-[58px] rounded-md border border-border bg-surface-muted p-2.5">
      <span className="block text-[9px] uppercase tracking-wide text-foreground-muted">
        {def.label}
      </span>
      <div className="mt-1 text-[11px] font-medium text-foreground">
        {editing ? (
          <FieldControl def={def} value={value} disabled={false} onChange={onChange} />
        ) : (
          viewValue(def, order)
        )}
      </div>
    </div>
  )
}

/** A read-only billing-grid cell. */
function BillingField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-h-[58px] rounded-md border border-border bg-surface-muted p-2.5">
      <span className="block text-[9px] uppercase tracking-wide text-foreground-muted">
        {label}
      </span>
      <span className="mt-1 block text-[11px] font-medium text-foreground">{children}</span>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Sub-tables                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function ReconhecimentosSection({
  order,
  rows,
  role,
  queryError,
}: {
  order: Order
  rows: Reconhecimento[]
  role: RoleLike
  queryError: string | null
}) {
  const orderId = order.ID_Order
  const sellPrice = order.Sell_Price
  const warrantyReserve = order.Tipo_Warranty === true ? order.Warranty_Reserve : 0
  // Warranty recognition types (W/WP) are only selectable when the order's kind
  // carries warranty (Tipo_Warranty). When Warranty=0 the warranty bucket capacity
  // is zero server-side, so the option is hidden here to prevent dead-end entries.
  const availableReconhecimentoTypes =
    order.Tipo_Warranty === true
      ? tpReconhecimentos
      : tpReconhecimentos.filter(
          (o) => !WARRANTY_RECONHECIMENTO_CODES.includes(String(o.id)),
        )
  const { reconhecimentos } = useRepositories()
  const queryClient = useQueryClient()
  const user = useCurrentUser()
  const updateMutation = useUpdateReconhecimento(orderId)
  const deleteMutation = useDeleteReconhecimento(orderId)
  const propagateMutation = usePropagateReconhecimento(orderId)

  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    type: 'P',
    date: new Date().toISOString().slice(0, 10),
    value: '',
  })

  // Inline row editing.
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ type: 'P', date: '', value: '' })

  // Maintenance-contract propagation dialog.
  const [contractOpen, setContractOpen] = useState(false)
  const [contractForm, setContractForm] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    recognitionDate: new Date().toISOString().slice(0, 10),
    years: '1',
  })

  // Pending propagation awaiting in-app confirmation. The native `window.confirm`
  // was replaced by `ConfirmDialog` because the browser exposes a "Prevent this
  // page from creating additional dialogs" checkbox that silently suppresses
  // every future confirmation — so the Propagate button appeared to do nothing
  // (the mutation was never fired). The in-app dialog asks fresh every time.
  type PropagateConfirm =
    | { kind: 'warranty'; description: string }
    | {
        kind: 'maintenance'
        description: string
        startDate: string
        years: number
        recognitionDate: string
      }
  const [propagateConfirm, setPropagateConfirm] = useState<PropagateConfirm | null>(null)

  const canAdd = role !== 'viewer'
  // Add (and the inline add form) is always open for any non-viewer — the user
  // explicitly asked that adding recognitions stays available even after the
  // order's month has closed. Only editing/deleting existing rows is gated.
  const canAddRow = canAddFinancial(role)
  // Editing/deleting existing rows: editor/user can do it while the order's
  // month is current or future; admin always; viewer never. Provisional orders
  // stay fully editable (handled inside canEditFinancial via isHistorico).
  const canEditRow = canEditFinancial(order, role)

  /** Remaining capacity in a recognition bucket, optionally excluding one row
   *  (the row being edited). Warranty codes W/WP draw from the Warranty_Reserve
   *  bucket; everything else draws from the instrument bucket
   *  (Sell_Price − Warranty_Reserve). Both clamp at 0 and never exceed Sell_Price
   *  in total, so req 5's "≤ Sell Price" holds. */
  function bucketCapacity(typeCode: string, excludeId: number | null = null): number {
    const isWarranty = typeCode === 'W' || typeCode === 'WP'
    const already = rows
      .filter((row) => row.ID_Reconhecimento !== excludeId)
      .filter(
        (row) =>
          (row.ID_Tp_Reconhecimento === 'W' || row.ID_Tp_Reconhecimento === 'WP') === isWarranty,
      )
      .reduce((sum, row) => sum + (row.Valor_Reconhecimento ?? 0), 0)
    const bucket = isWarranty ? (warrantyReserve ?? 0) : (sellPrice ?? 0) - (warrantyReserve ?? 0)
    return Math.max(0, bucket - already)
  }

  const capacity = bucketCapacity(form.type)

  async function handleAdd() {
    setError(null)
    const value = Number(form.value)
    if (!Number.isFinite(value) || value <= 0 || value > capacity + 0.0001) {
      setError(
        `Invalid value. Available: ${formatPrice(capacity)}. Total recognised cannot exceed the Sell Price.`,
      )
      return
    }
    setSaving(true)
    try {
      const created = await reconhecimentos.add(
        {
          ID_Order: orderId,
          ID_Tp_Reconhecimento: form.type,
          DT_Reconhecimento: new Date(form.date).toISOString(),
          Valor_Reconhecimento: value,
          ID_User: String(user.ID_User),
        },
        role,
      )
      // Reflect the new row instantly; the order's `Reconhecido` flag is
      // recomputed server-side, so refresh the detail/list in the background.
      // The recognition list is invalidated too so the server re-sorts it by
      // `DT_Reconhecimento` (the appended row may land out of order); the cached
      // rows stay on screen during the refetch, so there is no flash.
      queryClient.setQueryData<Reconhecimento[]>(['orders', 'reconhecimentos', orderId], (old) => [
        ...(old ?? []),
        created,
      ])
      queryClient.invalidateQueries({ queryKey: ['orders', 'reconhecimentos', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'list'] })
      setAdding(false)
      setForm({ type: 'P', date: new Date().toISOString().slice(0, 10), value: '' })
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not add the recognition.',
      )
    } finally {
      setSaving(false)
    }
  }

  function startEditRow(r: Reconhecimento) {
    setEditingId(r.ID_Reconhecimento)
    setEditForm({
      type: r.ID_Tp_Reconhecimento ?? 'P',
      date: r.DT_Reconhecimento ? r.DT_Reconhecimento.slice(0, 10) : '',
      value: r.Valor_Reconhecimento == null ? '' : String(r.Valor_Reconhecimento),
    })
    setError(null)
  }

  function saveEditRow(r: Reconhecimento) {
    const value = Number(editForm.value)
    const cap = bucketCapacity(editForm.type, r.ID_Reconhecimento)
    if (!Number.isFinite(value) || value <= 0 || value > cap + 0.0001) {
      setError(
        `Invalid value. Available: ${formatPrice(cap)}. Total recognised cannot exceed the Sell Price.`,
      )
      return
    }
    updateMutation.mutate(
      {
        id: r.ID_Reconhecimento,
        patch: {
          ID_Tp_Reconhecimento: editForm.type || null,
          DT_Reconhecimento: editForm.date ? new Date(editForm.date).toISOString() : null,
          Valor_Reconhecimento: editForm.value === '' ? null : Number(editForm.value),
        },
      },
      {
        onSuccess: () => setEditingId(null),
        onError: (e) =>
          setError(e instanceof Error ? e.message : 'Could not save the recognition.'),
      },
    )
  }

  function handleDelete(r: Reconhecimento) {
    deleteMutation.mutate(
      { id: r.ID_Reconhecimento },
      {
        onError: (e) =>
          setError(e instanceof Error ? e.message : 'Could not delete the recognition.'),
      },
    )
  }

  // Propagation availability + preview (req 10 & 12). The math lives in pure
  // domain functions so it stays identical in mock and HTTP repos.
  const warrantyPlan = planWarrantyPropagation(order)
  const canPropagateWarranty =
    order.Tipo_Warranty === true && order.ID_Tp_Warranty != null && warrantyPlan.length > 0
  const isContract = order.ID_Tipo === 'CM'
  const contractYears = Number(contractForm.years)
  const contractYearsValid =
    Number.isInteger(contractYears) && contractYears >= 1 && contractYears <= 100
  const contractPlan =
    isContract &&
    contractOpen &&
    contractYearsValid &&
    contractForm.startDate &&
    contractForm.recognitionDate
      ? planMaintenancePropagation(
          order,
          contractForm.startDate,
          contractYears,
          contractForm.recognitionDate,
        )
      : []

  function handlePropagateWarranty() {
    const monthly = warrantyPlan[0]?.value ?? 0
    setPropagateConfirm({
      kind: 'warranty',
      description: `Propagate ${warrantyPlan.length} warranty recognitions (WP) at ${formatPrice(monthly)}/month, starting ${formatOrderDate(
        warrantyPlan[0]?.date ?? null,
      )}? Total: ${formatPrice(warrantyPlan.reduce((s, l) => s + l.value, 0))}.`,
    })
  }

  function handlePropagateContract() {
    setError(null)
    const years = Number(contractForm.years)
    if (
      !contractForm.startDate ||
      !contractForm.recognitionDate ||
      !Number.isInteger(years) ||
      years < 1 ||
      years > 100
    ) {
      setError(
        'Provide the contract start date, recognition date and a whole number of years between 1 and 100.',
      )
      return
    }
    const preview = planMaintenancePropagation(
      order,
      contractForm.startDate,
      years,
      contractForm.recognitionDate,
    )
    setPropagateConfirm({
      kind: 'maintenance',
      description: `Propagate ${preview.length} maintenance recognitions (CM) at ${formatPrice(preview[0]?.value ?? 0)}/month, starting ${formatOrderDate(
        preview[0]?.date ?? null,
      )}? Total: ${formatPrice(preview.reduce((s, l) => s + l.value, 0))}.`,
      startDate: contractForm.startDate,
      years,
      recognitionDate: contractForm.recognitionDate,
    })
  }

  // Fires the deferred propagation mutation once the user confirms the in-app
  // dialog. Closing the dialog (Cancel / Escape / backdrop) clears the pending
  // request without mutating.
  function confirmPropagate() {
    if (!propagateConfirm) return
    setError(null)
    if (propagateConfirm.kind === 'warranty') {
      propagateMutation.mutate(
        { kind: 'warranty' },
        {
          onSuccess: () => setPropagateConfirm(null),
          onError: (e) =>
            setError(
              e instanceof Error
                ? e.message
                : 'Could not propagate the warranty recognitions.',
            ),
        },
      )
      return
    }
    propagateMutation.mutate(
      {
        kind: 'maintenance',
        startDate: propagateConfirm.startDate,
        years: propagateConfirm.years,
        recognitionDate: propagateConfirm.recognitionDate,
      },
      {
        onSuccess: () => {
          setContractOpen(false)
          setPropagateConfirm(null)
        },
        onError: (e) =>
          setError(
            e instanceof Error
              ? e.message
              : 'Could not propagate the maintenance recognitions.',
          ),
      },
    )
  }

  const propagateActions = (
    <div className="flex flex-wrap items-center gap-2">
      {canPropagateWarranty && canAdd && canAddRow && (
        <Button
          size="sm"
          variant="secondary"
          onClick={handlePropagateWarranty}
          disabled={propagateMutation.isPending}
        >
          <Sparkles className="size-4" aria-hidden /> Propagate warranty
        </Button>
      )}
      {isContract && canAdd && canAddRow && !contractOpen && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setContractOpen(true)}
          disabled={propagateMutation.isPending}
        >
          <Sparkles className="size-4" aria-hidden /> Propagate contract
        </Button>
      )}
    </div>
  )

  return (
    <SectionCard
      title="RECOGNITIONS"
      action={
        <div className="flex flex-wrap items-center gap-2">
          {propagateActions}
          {canAddRow && !adding && (
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden /> Add Recognition
            </Button>
          )}
        </div>
      }
    >
      {queryError && (
        <p
          role="alert"
          className="border-b border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {queryError}
        </p>
      )}
      {contractOpen && (
        <div className="flex flex-wrap items-end gap-2 border-b border-border bg-surface-muted p-3">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-foreground-muted">
            Contract start
            <DatePicker
              aria-label="Contract start"
              value={contractForm.startDate || null}
              onChange={(next) => setContractForm((f) => ({ ...f, startDate: next ?? '' }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-foreground-muted">
            Recognition date
            <DatePicker
              aria-label="Recognition date"
              value={contractForm.recognitionDate || null}
              onChange={(next) =>
                setContractForm((f) => ({ ...f, recognitionDate: next ?? '' }))
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-foreground-muted">
            Years
            <Input
              type="number"
              aria-label="Contract years"
              min="1"
              max="100"
              step="1"
              value={contractForm.years}
              onChange={(e) => setContractForm((f) => ({ ...f, years: e.target.value }))}
            />
          </label>
          <Button
            size="sm"
            onClick={handlePropagateContract}
            disabled={propagateMutation.isPending}
          >
            Propagate
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setContractOpen(false)}
            disabled={propagateMutation.isPending}
          >
            Cancel
          </Button>
          {contractPlan.length > 0 && (
            <span className="text-[10px] text-foreground/60">
              {contractPlan.length} rows of {formatPrice(contractPlan[0].value)}/mo • total{' '}
              {formatPrice(contractPlan.reduce((s, l) => s + l.value, 0))}
            </span>
          )}
        </div>
      )}
      {adding && (
        <div className="flex flex-wrap items-end gap-2 border-b border-border bg-surface-muted p-3">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-foreground-muted">
            Type
            <Select
              aria-label="Recognition type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              disabled={!canAddRow}
            >
              {availableReconhecimentoTypes.map((o) => (
                <option key={String(o.id)} value={String(o.id)}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-foreground-muted">
            Data
            <DatePicker
              aria-label="Recognition date"
              value={form.date || null}
              onChange={(next) => setForm((f) => ({ ...f, date: next ?? '' }))}
              disabled={!canAddRow}
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-foreground-muted">
            Value
            <Input
              type="number"
              aria-label="Recognition value"
              value={form.value}
              min="0"
              max={capacity}
              step="0.01"
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              disabled={!canAddRow}
            />
          </label>
          <Button size="sm" onClick={handleAdd} disabled={saving || !canAddRow}>
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={saving}>
            Cancel
          </Button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="border-b border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="m-3 rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-foreground/50">
          No recognitions.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-[10px] uppercase text-foreground-muted">
                <th className="px-2.5 py-1.5 font-semibold">Type</th>
                <th className="px-2.5 py-1.5 font-semibold">Data do Reconhecimento</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Value</th>
                <th className="px-2.5 py-1.5 font-semibold">Status</th>
                {canAdd && <th className="px-2.5 py-1.5 text-right font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const estado = reconhecimentoEstado(r)
                if (editingId === r.ID_Reconhecimento) {
                  return (
                    <tr
                      key={r.ID_Reconhecimento}
                      className="border-b border-border/50 bg-surface-muted"
                    >
                      <td className="px-2.5 py-1.5">
                        <Select
                          aria-label="Recognition type"
                          value={editForm.type}
                          onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                          disabled={!canEditRow}
                        >
                          {availableReconhecimentoTypes.map((o) => (
                            <option key={String(o.id)} value={String(o.id)}>
                              {o.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-2.5 py-1.5">
                        <DatePicker
                          aria-label="Recognition date"
                          value={editForm.date || null}
                          onChange={(next) => setEditForm((f) => ({ ...f, date: next ?? '' }))}
                          disabled={!canEditRow}
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="number"
                          aria-label="Recognition value"
                          value={editForm.value}
                          min="0"
                          step="0.01"
                          onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))}
                          disabled={!canEditRow}
                        />
                      </td>
                      <td className="px-2.5 py-1.5" />
                      <td className="px-2.5 py-1.5 text-right">
                        <Button
                          size="sm"
                          onClick={() => saveEditRow(r)}
                          disabled={updateMutation.isPending || !canEditRow}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          disabled={updateMutation.isPending}
                        >
                          Cancel
                        </Button>
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr key={r.ID_Reconhecimento} className="border-b border-border/50">
                    <td className="px-2.5 py-1.5 text-[11px]">
                      {displayText(reconhecimentoLabel(r.ID_Tp_Reconhecimento))}
                    </td>
                    <td className="px-2.5 py-1.5 text-[11px]">
                      {formatOrderDate(r.DT_Reconhecimento)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right text-[11px]">
                      {formatPrice(r.Valor_Reconhecimento)}
                    </td>
                    <td className="px-2.5 py-1.5">
                      {estado === 'reconhecido' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-semibold text-success">
                          <span className="size-1.5 rounded-full bg-success" aria-hidden />
                          Reconhecido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/10 px-2 py-0.5 text-[9px] text-foreground/60">
                          <span className="size-1.5 rounded-full bg-foreground/40" aria-hidden />
                          Por reconhecer
                        </span>
                      )}
                    </td>
                    {canAdd && canEditRow && (
                      <td className="px-2.5 py-1.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Edit recognition row ${r.ID_Reconhecimento}`}
                            onClick={() => startEditRow(r)}
                            disabled={updateMutation.isPending || deleteMutation.isPending}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete recognition row ${r.ID_Reconhecimento}`}
                            onClick={() => handleDelete(r)}
                            disabled={updateMutation.isPending || deleteMutation.isPending}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                      </td>
                    )}
                    {canAdd && !canEditRow && (
                      <td className="px-2.5 py-1.5 text-right text-[10px] text-foreground/45">
                        <span
                          className="inline-flex items-center gap-1"
                          aria-label="Field locked (month closed)"
                          title="Recognition rows are locked because this order's month has closed. Only an admin can change them."
                        >
                          <LockIcon /> Locked
                        </span>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={propagateConfirm !== null}
        title="Propagate recognitions"
        description={propagateConfirm?.description ?? ''}
        confirmLabel="Propagate"
        cancelLabel="Cancel"
        busy={propagateMutation.isPending}
        onConfirm={confirmPropagate}
        onClose={() => setPropagateConfirm(null)}
      />
    </SectionCard>
  )
}

/** Sub-table of Kit_Consumables for an order (dbo.Kit_Consumables). Mirrors the
 *  ReconhecimentosSection shape — inline add/edit/delete (trash fires the
 *  mutation directly, no confirm dialog) — but without capacity enforcement:
 *  the Balance (Kit_Amount − Σ Total_Price) is display-only, computed by the
 *  parent Kit tab. dbo.Kit_Consumables has no audit columns, so no
 *  ID_User/DT_User are sent. */
function KitConsumablesSection({
  order,
  rows,
  role,
  queryError,
}: {
  order: Order
  rows: KitConsumable[]
  role: RoleLike
  queryError: string | null
}) {
  const orderId = order.ID_Order
  const queryClient = useQueryClient()
  const addMutation = useAddKitConsumable(orderId)
  const updateMutation = useUpdateKitConsumable(orderId)
  const deleteMutation = useDeleteKitConsumable(orderId)

  const canAdd = role !== 'viewer'

  const emptyForm = () => ({
    date: new Date().toISOString().slice(0, 10),
    internalOrder: '',
    material: '',
    description: '',
    quant: '',
    unitPrice: '',
    totalPrice: '',
  })

  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  // Inline row editing.
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)

  /** Recompute Total_Price = Quant × Unit_Price when either changes, unless the
   *  user has overridden it. Kept simple: always recompute from the two inputs. */
  function withComputedTotal(
    f: ReturnType<typeof emptyForm>,
  ): ReturnType<typeof emptyForm> {
    const quant = Number(f.quant)
    const unit = Number(f.unitPrice)
    const computed =
      Number.isFinite(quant) && Number.isFinite(unit) ? String(round2(quant * unit)) : ''
    return { ...f, totalPrice: computed }
  }

  /** Σ Total_Price of the rows already persisted. Used by both the add and the
   *  edit paths so the cap check stays in one place (validateKitForm). */
  const existingTotal = rows.reduce((sum, r) => sum + (r.Total_Price ?? 0), 0)

  async function handleAdd() {
    setError(null)
    const validation = validateKitForm(form, existingTotal, order.Kit_Amount ?? null)
    if (validation) {
      setError(validation)
      return
    }
    setSaving(true)
    try {
      await addMutation.mutateAsync({
        ID_Order: orderId,
        Date: new Date(form.date).toISOString(),
        Internal_Order: form.internalOrder,
        Material: form.material,
        Description: form.description,
        Quant: Number(form.quant),
        Unit_Price: Number(form.unitPrice),
        Total_Price: Number(form.totalPrice),
      })
      // The mutation hook appends the returned row directly to the cache. Refresh
      // from server truth in the background so ordering and the detail remain fresh.
      queryClient.invalidateQueries({ queryKey: ['orders', 'kit-consumables', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] })
      setAdding(false)
      setForm(emptyForm())
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not add the kit consumable.',
      )
    } finally {
      setSaving(false)
    }
  }

  function startEditRow(r: KitConsumable) {
    setEditingId(r.ID_Kit)
    setEditForm({
      date: r.Date ? r.Date.slice(0, 10) : '',
      internalOrder: r.Internal_Order ?? '',
      material: r.Material ?? '',
      description: r.Description ?? '',
      quant: r.Quant == null ? '' : String(r.Quant),
      unitPrice: r.Unit_Price == null ? '' : String(r.Unit_Price),
      totalPrice: r.Total_Price == null ? '' : String(r.Total_Price),
    })
    setError(null)
  }

  function saveEditRow(r: KitConsumable) {
    // Exclude the row being edited from the existing total so its own value isn't
    // counted twice in the cap check.
    const totalExcludingSelf = existingTotal - (r.Total_Price ?? 0)
    const validation = validateKitForm(editForm, totalExcludingSelf, order.Kit_Amount ?? null)
    if (validation) {
      setError(validation)
      return
    }
    updateMutation.mutate(
      {
        id: r.ID_Kit,
        patch: {
          Date: new Date(editForm.date).toISOString(),
          Internal_Order: editForm.internalOrder,
          Material: editForm.material,
          Description: editForm.description,
          Quant: Number(editForm.quant),
          Unit_Price: Number(editForm.unitPrice),
          Total_Price: Number(editForm.totalPrice),
        },
      },
      {
        onSuccess: () => setEditingId(null),
        onError: (e) =>
          setError(
            e instanceof Error
              ? e.message
              : 'Could not save the kit consumable.',
          ),
      },
    )
  }

  function handleDelete(r: KitConsumable) {
    deleteMutation.mutate(
      { id: r.ID_Kit },
      {
        onError: (e) =>
          setError(
            e instanceof Error
              ? e.message
              : 'Could not delete the kit consumable.',
          ),
      },
    )
  }

  return (
    <SectionCard
      title="CONSUMÍVEIS DO KIT"
      action={
        canAdd &&
        !adding && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden /> Add Consumable
          </Button>
        )
      }
    >
      {queryError && (
        <p
          role="alert"
          className="border-b border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {queryError}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="border-b border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {error}
        </p>
      )}

      {rows.length === 0 && !adding ? (
        <p className="m-3 rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-foreground/50">
          No kit consumables.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-[10px] uppercase text-foreground-muted">
                <th className="px-2.5 py-1.5 font-semibold">Data</th>
                <th className="px-2.5 py-1.5 font-semibold">Internal Order</th>
                <th className="px-2.5 py-1.5 font-semibold">Material</th>
                <th className="px-2.5 py-1.5 font-semibold">Description</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Quant</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Unit Price</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Total</th>
                {canAdd && <th className="px-2.5 py-1.5 text-right font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {adding && (
                <tr className="border-b border-border/50 bg-surface-muted">
                  <KitConsumableForm
                    form={form}
                    onChange={(f) => setForm(withComputedTotal(f))}
                  />
                  <td className="px-2.5 py-1.5 text-right">
                    <Button size="sm" onClick={handleAdd} disabled={saving}>
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAdding(false)}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                if (editingId === r.ID_Kit) {
                  return (
                    <tr
                      key={r.ID_Kit}
                      className="border-b border-border/50 bg-surface-muted"
                    >
                      <td className="px-2.5 py-1.5">
                        <DatePicker
                          aria-label="Consumable date"
                          value={editForm.date || null}
                          onChange={(next) =>
                            setEditForm(
                              withComputedTotal({ ...editForm, date: next ?? '' }),
                            )
                          }
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="text"
                          aria-label="Internal order"
                          value={editForm.internalOrder}
                          onChange={(e) =>
                            setEditForm(withComputedTotal({ ...editForm, internalOrder: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="text"
                          aria-label="Material"
                          value={editForm.material}
                          onChange={(e) =>
                            setEditForm(withComputedTotal({ ...editForm, material: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="text"
                          aria-label="Description"
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm(withComputedTotal({ ...editForm, description: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="number"
                          aria-label="Quantity"
                          min="1"
                          step="1"
                          value={editForm.quant}
                          onChange={(e) =>
                            setEditForm(withComputedTotal({ ...editForm, quant: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="number"
                          aria-label="Unit price"
                          min="0"
                          step="0.01"
                          value={editForm.unitPrice}
                          onChange={(e) =>
                            setEditForm(withComputedTotal({ ...editForm, unitPrice: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="number"
                          aria-label="Total"
                          min="0"
                          step="0.01"
                          value={editForm.totalPrice}
                          onChange={(e) =>
                            setEditForm({ ...editForm, totalPrice: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-2.5 py-1.5 text-right">
                        <Button
                          size="sm"
                          onClick={() => saveEditRow(r)}
                          disabled={updateMutation.isPending}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          disabled={updateMutation.isPending}
                        >
                          Cancel
                        </Button>
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr key={r.ID_Kit} className="border-b border-border/50">
                    <td className="px-2.5 py-1.5 text-[11px]">{formatOrderDate(r.Date)}</td>
                    <td className="px-2.5 py-1.5 text-[11px]">
                      {displayText(r.Internal_Order)}
                    </td>
                    <td className="px-2.5 py-1.5 text-[11px]">{displayText(r.Material)}</td>
                    <td className="px-2.5 py-1.5 text-[11px]">{displayText(r.Description)}</td>
                    <td className="px-2.5 py-1.5 text-right text-[11px]">{r.Quant ?? DASH}</td>
                    <td className="px-2.5 py-1.5 text-right text-[11px]">
                      {formatPrice(r.Unit_Price)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right text-[11px]">
                      {formatPrice(r.Total_Price)}
                    </td>
                    {canAdd && (
                      <td className="px-2.5 py-1.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Edit kit consumable ${r.ID_Kit}`}
                            onClick={() => startEditRow(r)}
                            disabled={updateMutation.isPending || deleteMutation.isPending}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete kit consumable ${r.ID_Kit}`}
                            onClick={() => handleDelete(r)}
                            disabled={updateMutation.isPending || deleteMutation.isPending}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

/** The inline add-form fields (Date, Internal Order, Material, Description, Quant,
 *  Unit Price, Total). Total is auto-computed by the caller; it stays editable so
 *  a user can override a rounded/adjusted value. */
function KitConsumableForm({
  form,
  onChange,
}: {
  form: ReturnType<() => {
    date: string
    internalOrder: string
    material: string
    description: string
    quant: string
    unitPrice: string
    totalPrice: string
  }>
  onChange: (f: typeof form) => void
}) {
  // Renders the seven field cells for the inline "add consumable" row. The
  // caller wraps these in a `<tr>` inside the consumables `<tbody>` so the
  // layout matches the inline-edit row exactly (one compact cell per field,
  // no vertical labels above each input).
  return (
    <>
      <td className="px-2.5 py-1.5">
        <DatePicker
          aria-label="Consumable date"
          value={form.date || null}
          onChange={(next) => onChange({ ...form, date: next ?? '' })}
        />
      </td>
      <td className="px-2.5 py-1.5">
        <Input
          type="text"
          aria-label="Internal order"
          value={form.internalOrder}
          onChange={(e) => onChange({ ...form, internalOrder: e.target.value })}
        />
      </td>
      <td className="px-2.5 py-1.5">
        <Input
          type="text"
          aria-label="Material"
          value={form.material}
          onChange={(e) => onChange({ ...form, material: e.target.value })}
        />
      </td>
      <td className="px-2.5 py-1.5">
        <Input
          type="text"
          aria-label="Description"
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
        />
      </td>
      <td className="px-2.5 py-1.5">
        <Input
          type="number"
          aria-label="Quantity"
          min="1"
          step="1"
          value={form.quant}
          onChange={(e) => onChange({ ...form, quant: e.target.value })}
        />
      </td>
      <td className="px-2.5 py-1.5">
        <Input
          type="number"
          aria-label="Unit price"
          min="0"
          step="0.01"
          value={form.unitPrice}
          onChange={(e) => onChange({ ...form, unitPrice: e.target.value })}
        />
      </td>
      <td className="px-2.5 py-1.5">
        <Input
          type="number"
          aria-label="Total"
          min="0"
          step="0.01"
          value={form.totalPrice}
          onChange={(e) => onChange({ ...form, totalPrice: e.target.value })}
        />
      </td>
    </>
  )
}

/** Validate a kit-consumable form. Returns an English error message or null.
 *
 *  `existingTotal` is the Σ Total_Price of the rows already persisted for this
 *  order; when editing, the caller subtracts the row being edited from that sum
 *  first so we never double-count. `kitAmount` is the order's Kit_Amount cap
 *  (req G3): the new total must fit under it, otherwise the save is rejected
 *  with a message that names the remaining budget. */
function validateKitForm(
  f: {
    date: string
    internalOrder: string
    material: string
    description: string
    quant: string
    unitPrice: string
    totalPrice: string
  },
  existingTotal: number,
  kitAmount: number | null,
): string | null {
  if (!f.date) return 'Date is required.'
  if (!f.internalOrder.trim()) return 'Internal order is required.'
  if (!f.material.trim()) return 'Material is required.'
  if (!f.description.trim()) return 'Description is required.'
  const quant = Number(f.quant)
  if (!Number.isFinite(quant) || quant <= 0 || !Number.isInteger(quant)) {
    return 'Quantity must be a positive integer.'
  }
  const unit = Number(f.unitPrice)
  if (!Number.isFinite(unit) || unit < 0) return 'Invalid unit price.'
  const total = Number(f.totalPrice)
  if (!Number.isFinite(total) || total < 0) return 'Invalid total.'
  if (kitAmount != null && existingTotal + total > kitAmount + 0.005) {
    const remaining = Math.max(0, kitAmount - existingTotal)
    return `Kit amount would be exceeded. Remaining budget: ${formatPrice(remaining)}.`
  }
  return null
}

/** Round to 2 decimals (money). Avoids floating-point noise like 0.30000000000000004. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function DocumentosTable({
  order,
  rows,
  role,
  documentTypes,
  documentTypesPending,
  documentTypesError,
  queryError,
}: {
  order: Order
  rows: DocumentoFaturacao[]
  role: RoleLike
  documentTypes: readonly DocumentoFaturacaoType[]
  documentTypesPending: boolean
  documentTypesError: string | null
  queryError: string | null
}) {
  const orderId = order.ID_Order
  const sellPrice = order.Sell_Price
  const { facturacao } = useRepositories()
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const updateMutation = useUpdateDocumentoFaturacao(orderId)
  const deleteMutation = useDeleteDocumentoFaturacao(orderId)

  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: '',
    number: '',
    value: '',
  })

  // Inline row editing.
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ date: '', type: '', number: '', value: '' })

  const defaultDocumentType =
    documentTypes.find((type) => type.id === 'FT')?.id ?? documentTypes[0]?.id ?? ''
  const documentTypeLabels = useMemo(
    () => new Map(documentTypes.map((type) => [type.id, type.label])),
    [documentTypes],
  )

  const canAdd = role !== 'viewer'
  // Adding a new invoice is always open for any non-viewer; only edit/delete
  // of existing rows is gated by the month lock. (canAddFinancial / canEditFinancial)
  const canAddRow = canAddFinancial(role)
  const canEditRow = canEditFinancial(order, role)
  const netInvoiced = rows.reduce((sum, d) => sum + (d.Valor_Doc_FT ?? 0), 0)
  // req 6: green highlight when the net invoiced equals Sell_Price.
  const fullyInvoiced =
    sellPrice != null && sellPrice > 0 && Math.abs(netInvoiced - sellPrice) <= 0.005

  /** Net invoiced excluding one row (the row being edited). Used to enforce
   *  req 5's "net faturado ≤ Sell Price" on the client. */
  function netExcluding(excludeId: number | null): number {
    return rows
      .filter((d) => d.ID_Facturacao !== excludeId)
      .reduce((sum, d) => sum + (d.Valor_Doc_FT ?? 0), 0)
  }

  function validateDoc(value: number, otherNet: number): string | null {
    if (!Number.isFinite(value)) return 'Invalid value.'
    if (sellPrice != null && otherNet + value > sellPrice + 0.005) {
      return `Net invoiced cannot exceed the Sell Price (${formatPrice(sellPrice)}).`
    }
    return null
  }

  /** Remaining capacity left before the next invoice tips the cumulative net over
   *  Sell_Price. Negative when the typed value already pushes past the limit, so
   *  the user sees the overage inline while typing (req D). */
  function remainingCapacity(existingNet: number, value: number): number | null {
    if (sellPrice == null || sellPrice <= 0) return null
    return sellPrice - existingNet - value
  }

  function startAdd() {
    setForm((current) => ({
      ...current,
      type: current.type || defaultDocumentType,
    }))
    setError(null)
    setAdding(true)
  }

  async function handleAdd() {
    if (!form.type || !form.number || form.value === '') return
    setError(null)
    const value = Number(form.value)
    const msg = validateDoc(value, netInvoiced)
    if (msg) {
      setError(msg)
      return
    }
    setSaving(true)
    try {
      const created = await facturacao.add(
        {
          ID_Order: orderId,
          DT_Doc_FT: new Date(form.date).toISOString(),
          ID_Tp_Doc_FT: form.type,
          N_Doc_FT: form.number,
          Valor_Doc_FT: Number(form.value),
          ID_User: String(user.ID_User),
        },
        role,
      )
      // Reflect the new document instantly; the order's `Facturado` flag is
      // recomputed server-side, so refresh the detail/list in the background.
      // The invoicing list is invalidated too so the server re-sorts it by
      // `DT_Doc_FT` (the appended row may land out of order); the cached rows
      // stay on screen during the refetch, so there is no flash.
      queryClient.setQueryData<DocumentoFaturacao[]>(['orders', 'facturacao', orderId], (old) => [
        ...(old ?? []),
        created,
      ])
      queryClient.invalidateQueries({ queryKey: ['orders', 'facturacao', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'list'] })
      setAdding(false)
      setForm({
        date: new Date().toISOString().slice(0, 10),
        type: defaultDocumentType,
        number: '',
        value: '',
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add the document.')
    } finally {
      setSaving(false)
    }
  }

  function startEditRow(d: DocumentoFaturacao) {
    setEditingId(d.ID_Facturacao)
    setEditForm({
      date: d.DT_Doc_FT ? d.DT_Doc_FT.slice(0, 10) : '',
      type: d.ID_Tp_Doc_FT ?? defaultDocumentType,
      number: d.N_Doc_FT ?? '',
      value: d.Valor_Doc_FT == null ? '' : String(d.Valor_Doc_FT),
    })
    setError(null)
  }

  function saveEditRow(d: DocumentoFaturacao) {
    if (!editForm.number || editForm.value === '') return
    const value = Number(editForm.value)
    const msg = validateDoc(value, netExcluding(d.ID_Facturacao))
    if (msg) {
      setError(msg)
      return
    }
    updateMutation.mutate(
      {
        id: d.ID_Facturacao,
        patch: {
          DT_Doc_FT: editForm.date ? new Date(editForm.date).toISOString() : null,
          ID_Tp_Doc_FT: editForm.type || null,
          N_Doc_FT: editForm.number,
          Valor_Doc_FT: Number(editForm.value),
        },
      },
      {
        onSuccess: () => setEditingId(null),
        onError: (e) =>
          setError(e instanceof Error ? e.message : 'Could not save the document.'),
      },
    )
  }

  function handleDelete(d: DocumentoFaturacao) {
    deleteMutation.mutate(
      { id: d.ID_Facturacao },
      {
        onError: (e) =>
          setError(e instanceof Error ? e.message : 'Could not delete the document.'),
      },
    )
  }

  return (
    <SectionCard
      title="DOCUMENTOS FATURADOS"
      action={
        canAdd && canAddRow && !adding && documentTypes.length > 0 ? (
          <Button size="sm" variant="secondary" onClick={startAdd}>
            <Plus className="size-4" aria-hidden /> Add documento
          </Button>
        ) : undefined
      }
    >
      {documentTypesPending && (
        <p className="border-b border-border px-3 py-2 text-xs text-foreground/60">
          A carregar tipos de documento…
        </p>
      )}
      {queryError && (
        <p
          role="alert"
          className="border-b border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {queryError}
        </p>
      )}
      {documentTypesError && (
        <p
          role="alert"
          className="border-b border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {documentTypesError}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="border-b border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {error}
        </p>
      )}
      {rows.length === 0 && !adding ? (
        <p className="m-3 rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-foreground/50">
          No documents.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-[10px] uppercase text-foreground-muted">
                <th className="px-2.5 py-1.5 font-semibold">Data</th>
                <th className="px-2.5 py-1.5 font-semibold">Documento</th>
                <th className="px-2.5 py-1.5 font-semibold">Nº</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Value</th>
                {canAdd && <th className="px-2.5 py-1.5 text-right font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {adding && (
                <tr className="border-b border-border/50 bg-surface-muted">
                  <td className="px-2.5 py-1.5">
                    <DatePicker
                      aria-label="Document date"
                      value={form.date || null}
                      onChange={(next) => setForm((f) => ({ ...f, date: next ?? '' }))}
                      disabled={!canAddRow}
                    />
                  </td>
                  <td className="px-2.5 py-1.5">
                    <Select
                      aria-label="Document type"
                      value={form.type}
                      onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                      disabled={!canAddRow}
                    >
                      {documentTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.label}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-2.5 py-1.5">
                    <Input
                      aria-label="Document number"
                      placeholder="Nº documento"
                      value={form.number}
                      onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                      disabled={!canAddRow}
                    />
                  </td>
                  <td className="px-2.5 py-1.5">
                    <div className="flex flex-col gap-1">
                      <Input
                        aria-label="Document value"
                        type="number"
                        step="0.01"
                        value={form.value}
                        onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                        disabled={!canAddRow}
                      />
                      <DocumentRemainingHint
                        remaining={remainingCapacity(
                          netInvoiced,
                          Number.isFinite(Number(form.value)) ? Number(form.value) : 0,
                        )}
                      />
                    </div>
                  </td>
                  <td className="px-2.5 py-1.5 text-right">
                    <Button size="sm" onClick={handleAdd} disabled={saving || !canAddRow}>
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAdding(false)}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  </td>
                </tr>
              )}
              {rows.map((d) => {
                if (editingId === d.ID_Facturacao) {
                  return (
                    <tr
                      key={d.ID_Facturacao}
                      className="border-b border-border/50 bg-surface-muted"
                    >
                      <td className="px-2.5 py-1.5">
                        <DatePicker
                          aria-label="Document date"
                          value={editForm.date || null}
                          onChange={(next) => setEditForm((f) => ({ ...f, date: next ?? '' }))}
                          disabled={!canEditRow}
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Select
                          aria-label="Document type"
                          value={editForm.type}
                          onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                          disabled={!canEditRow}
                        >
                          {editForm.type && !documentTypeLabels.has(editForm.type) && (
                            <option value={editForm.type}>{editForm.type}</option>
                          )}
                          {documentTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          aria-label="Document number"
                          value={editForm.number}
                          onChange={(e) => setEditForm((f) => ({ ...f, number: e.target.value }))}
                          disabled={!canEditRow}
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <div className="flex flex-col gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            aria-label="Document value"
                            value={editForm.value}
                            onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))}
                            disabled={!canEditRow}
                          />
                          <DocumentRemainingHint
                            remaining={remainingCapacity(
                              netExcluding(d.ID_Facturacao),
                              Number.isFinite(Number(editForm.value))
                                ? Number(editForm.value)
                                : 0,
                            )}
                          />
                        </div>
                      </td>
                      <td className="px-2.5 py-1.5 text-right">
                        <Button
                          size="sm"
                          onClick={() => saveEditRow(d)}
                          disabled={updateMutation.isPending || !canEditRow}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          disabled={updateMutation.isPending}
                        >
                          Cancel
                        </Button>
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr key={d.ID_Facturacao} className="border-b border-border/50">
                    <td className="px-2.5 py-1.5 text-[11px]">{formatOrderDate(d.DT_Doc_FT)}</td>
                    <td className="px-2.5 py-1.5 text-[11px]">
                      {displayText(
                        d.ID_Tp_Doc_FT
                          ? (documentTypeLabels.get(d.ID_Tp_Doc_FT) ?? d.ID_Tp_Doc_FT)
                          : null,
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 text-[11px]">{displayText(d.N_Doc_FT)}</td>
                    <td className="px-2.5 py-1.5 text-right text-[11px]">
                      {formatPrice(d.Valor_Doc_FT)}
                    </td>
                    {canAdd && canEditRow && (
                      <td className="px-2.5 py-1.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Edit document row ${d.ID_Facturacao}`}
                            onClick={() => startEditRow(d)}
                            disabled={updateMutation.isPending || deleteMutation.isPending}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete document row ${d.ID_Facturacao}`}
                            onClick={() => handleDelete(d)}
                            disabled={updateMutation.isPending || deleteMutation.isPending}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                      </td>
                    )}
                    {canAdd && !canEditRow && (
                      <td className="px-2.5 py-1.5 text-right text-[10px] text-foreground/45">
                        <span
                          className="inline-flex items-center gap-1"
                          aria-label="Field locked (month closed)"
                          title="Invoicing documents are locked because this order's month has closed. Only an admin can change them."
                        >
                          <LockIcon /> Locked
                        </span>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr
                data-highlight={fullyInvoiced ? 'true' : undefined}
                className={fullyInvoiced ? 'bg-success/15 text-success' : 'text-foreground/60'}
              >
                <td className="px-2.5 py-1.5 text-[11px] font-semibold" colSpan={3}>
                  Net faturado
                </td>
                <td className="px-2.5 py-1.5 text-right text-[11px] font-semibold">
                  {formatPrice(netInvoiced)}
                </td>
                {canAdd && <td className="px-2.5 py-1.5" />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

/** Tiny live hint that sits under the new-document value input. Renders nothing when
 *  the order has no Sell_Price (the cap doesn't apply); shows the remaining capacity
 *  when within budget, or the overage when the typed value would push past it. The
 *  user sees the gap update as they type, so they know whether the line will be
 *  accepted before pressing Add. */
function DocumentRemainingHint({ remaining }: { remaining: number | null }) {
  if (remaining === null) return null
  if (remaining >= 0) {
    return (
      <p aria-live="polite" className="text-[11px] text-foreground/50">
        Remaining to Sell Price: {formatPrice(remaining)}
      </p>
    )
  }
  return (
    <p role="alert" aria-live="polite" className="text-[11px] font-medium text-danger">
      Exceeds Sell Price by {formatPrice(-remaining)}
    </p>
  )
}

function ObservacoesEditor({ order, role }: { order: Order; role: RoleLike }) {
  const mutation = useUpdateOrder()
  const [value, setValue] = useState(order.Obs ?? '')
  const canSave = role !== 'viewer'
  function save() {
    if (!canSave || value === (order.Obs ?? '')) return
    mutation.mutate({ id: order.ID_Order, patch: { Obs: value || null } })
  }
  return (
    <div className="p-3">
      <textarea
        aria-label="Notes"
        disabled={!canSave || mutation.isPending}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="min-h-48 w-full resize-y rounded-md border border-border bg-surface p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />
      {mutation.isError && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {mutation.error.message}
        </p>
      )}
      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          onClick={save}
          disabled={!canSave || mutation.isPending || value === (order.Obs ?? '')}
        >
          Save observações
        </Button>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Page                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

function BackButton() {
  const navigate = useNavigate()
  return (
    <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>
      <ArrowLeft className="size-4" aria-hidden />
      Back
    </Button>
  )
}

function notFoundState(description: string) {
  return (
    <EmptyState
      icon={CircleAlert}
      title="Order not found"
      description={description}
      action={<BackButton />}
    />
  )
}

export function OrderDetailPage() {
  const params = useParams<{ id: string }>()
  const idParam = params.id
  const orderId = idParam ? Number(idParam) : NaN
  const {
    data: order,
    isPending,
    isError,
    error,
  } = useOrder(Number.isNaN(orderId) ? null : orderId)

  if (Number.isNaN(orderId)) return notFoundState('The order identifier is invalid.')

  if (isPending) return <LoadingBlock label="Loading order…" />

  if (isError) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Couldn't load order"
        description={error instanceof Error ? error.message : 'Something went wrong.'}
        action={<BackButton />}
      />
    )
  }

  if (!order) return notFoundState('This order may have been removed.')

  return <OrderDetail order={order} />
}

function OrderDetail({ order }: { order: Order }) {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const roleSwitcher = useRoleSwitcher()
  const role = user.role
  const mutation = useUpdateOrder()

  const recoQuery = useReconhecimentos(order.ID_Order)
  const docsQuery = useDocumentoFaturacao(order.ID_Order)
  const documentTypesQuery = useDocumentoFaturacaoTypes()
  const kitConsumablesQuery = useKitConsumables(order.Kit === true ? order.ID_Order : null)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>({})

  const estado = useMemo(() => orderEstado(order), [order])
  const historico = useMemo(() => isHistorico(order), [order])
  const clientName = order.Client_Name ?? resolveClientName(order.ID_Client)

  // Área → Produto → Instrumento cascade. In view mode labels resolve from the static
  // fixtures (see viewValue/optionLabel), so the live queries only need to run while
  // editing — they back the parent-filtered dropdown options. The held child id is
  // merged back in (mergeSaved) so a legacy value that drifts from its parent stays
  // visible instead of vanishing from the dropdown.
  const areasQuery = useAreas({ enabled: editing })
  const cascadeArea = editing ? draft.ID_Area || undefined : undefined
  const produtosQuery = useProdutos({ area: cascadeArea, enabled: editing })
  const cascadeProduto = editing ? Number(draft.ID_Produto) || undefined : undefined
  const instrumentosQuery = useInstrumentos({ produto: cascadeProduto, enabled: editing })
  const produtoOptions = mergeSaved(produtosQuery.data, draft.ID_Produto, produtos)
  const instrumentoOptions = mergeSaved(instrumentosQuery.data, draft.ID_Instrumento, instrumentos)

  function startEdit() {
    setDraft(seedDraft(order))
    setEditing(true)
  }
  function cancelEdit() {
    setEditing(false)
    setDraft({})
  }
  function save() {
    const patch = buildPatch(draft, order)
    if (Object.keys(patch).length === 0) {
      setEditing(false)
      setDraft({})
      return
    }
    mutation.mutate(
      { id: order.ID_Order, patch },
      {
        onSuccess: () => {
          setEditing(false)
          setDraft({})
        },
      },
    )
  }

  function setField(key: string, value: string) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  // Cascade setters mirror the create form: changing Área clears Produto + Instrumento;
  // changing Produto clears Instrumento. The child dropdowns re-filter on the next render.
  function setAreaField(value: string) {
    setDraft((d) => ({ ...d, ID_Area: value, ID_Produto: '', ID_Instrumento: '' }))
  }
  function setProdutoField(value: string) {
    setDraft((d) => ({ ...d, ID_Produto: value, ID_Instrumento: '' }))
  }

  // Recognition split (req 9): the warranty vs instrument bucket math lives in the
  // pure `recognitionTotals` helper so it stays identical in mock and HTTP repos and
  // is unit-tested. "Instrument to Recognise" = (Sell_Price − Warranty_Reserve) −
  // instrument reconhecido (the fix for the old formula that dropped the reserve).
  const recos = recoQuery.data ?? []
  const totals = recognitionTotals(order, recos)
  const {
    instrumentReconhecido,
    instrumentPorReconhecer,
    warrantyReconhecido,
    warrantyPorReconhecer,
    totalReconhecido,
  } = totals
  // req 6: green highlight on "Total Recognised" when it reaches Sell_Price.
  const fullyRecognized =
    order.Sell_Price != null &&
    order.Sell_Price > 0 &&
    Math.abs(totalReconhecido - order.Sell_Price) <= 0.005

  const docs = docsQuery.data ?? []
  const documentTypes = documentTypesQuery.data ?? []
  const documentTypesError = documentTypesQuery.isError
    ? documentTypesQuery.error instanceof Error
      ? documentTypesQuery.error.message
      : 'Could not load document types.'
    : null
  const recoError = recoQuery.isError
    ? recoQuery.error instanceof Error
      ? recoQuery.error.message
      : 'Could not load recognitions.'
    : null
  const docsError = docsQuery.isError
    ? docsQuery.error instanceof Error
      ? docsQuery.error.message
      : 'Could not load invoicing documents.'
    : null
  const netInvoiced = docs.reduce((sum, d) => sum + (d.Valor_Doc_FT ?? 0), 0)
  const porFaturar = (order.Sell_Price ?? 0) - netInvoiced

  // Kit tab (only for kit orders): Balance = Kit_Amount − Σ Kit_Consumables.Total_Price.
  // The consumables query is enabled only when order.Kit === true (above), so the
  // empty array is the correct fallback for non-kit orders and during loading.
  const kitConsumables = kitConsumablesQuery.data ?? []
  const kitConsumedTotal = kitConsumables.reduce((sum, r) => sum + (r.Total_Price ?? 0), 0)
  const kitBalance = (order.Kit_Amount ?? 0) - kitConsumedTotal
  const kitConsumablesError = kitConsumablesQuery.isError
    ? kitConsumablesQuery.error instanceof Error
      ? kitConsumablesQuery.error.message
      : 'Could not load kit consumables.'
    : null

  const canEnterEdit = role !== 'viewer' && (!historico || role === 'admin' || role === 'editor')
  const canCreate = role !== 'viewer'

  const revenueMetrics = (
    <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
      <EditableMetric
        def={REVENUE_FIELDS[0]}
        order={order}
        editing={editing}
        role={role}
        value={draft[REVENUE_FIELDS[0].key] ?? ''}
        onChange={(v) => setField(REVENUE_FIELDS[0].key, v)}
        tone="blue"
        icon={ShoppingCart}
        tag="Total"
      />
      {/* Warranty Reserve only applies to warranty order kinds (req 11). */}
      {order.Tipo_Warranty === true && (
        <EditableMetric
          def={REVENUE_FIELDS[1]}
          order={order}
          editing={editing}
          role={role}
          value={draft[REVENUE_FIELDS[1].key] ?? ''}
          onChange={(v) => setField(REVENUE_FIELDS[1].key, v)}
          tone="green"
          icon={ShieldCheck}
        />
      )}
      <MetricCard
        tone="purple"
        icon={BadgeCheck}
        label="Instrument Recognised"
        value={formatPrice(instrumentReconhecido)}
      />
      <MetricCard
        tone="orange"
        icon={Clock}
        label="Instrument to Recognise"
        value={formatPrice(instrumentPorReconhecer)}
      />
      {/* Warranty KPIs only apply to warranty order kinds (req 11). */}
      {order.Tipo_Warranty === true && (
        <>
          <MetricCard
            tone="green"
            icon={ShieldCheck}
            label="Warranty Recognised"
            value={formatPrice(warrantyReconhecido)}
          />
          <MetricCard
            tone="orange"
            icon={ShieldAlert}
            label="Warranty to Recognise"
            value={formatPrice(warrantyPorReconhecer)}
          />
        </>
      )}
      <MetricCard
        tone="blue"
        icon={TrendingUp}
        label="Total Recognised"
        value={formatPrice(totalReconhecido)}
        highlight={fullyRecognized}
      />
    </div>
  )

  const tabs: TabItem[] = [
    {
      id: 'revenue',
      label: 'Revenue',
      content: (
        <div className="space-y-3 pt-3.5">
          {revenueMetrics}
          <ReconhecimentosSection order={order} rows={recos} role={role} queryError={recoError} />
          <DocumentosTable
            order={order}
            rows={docs}
            role={role}
            documentTypes={documentTypes}
            documentTypesPending={documentTypesQuery.isPending}
            documentTypesError={documentTypesError}
            queryError={docsError}
          />
        </div>
      ),
    },
    {
      id: 'faturacao',
      label: 'Invoicing',
      content: (
        <div className="space-y-3 pt-3.5">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            <MetricCard
              tone="orange"
              icon={Receipt}
              label="Remaining to Invoice"
              value={formatPrice(porFaturar)}
            />
            <MetricCard
              tone="green"
              icon={FileText}
              label="Documentos Emitidos"
              value={String(docs.length)}
            />
            <MetricCard tone="purple" icon={Mail} label="Email Status" value="Not sent" />
          </div>

          <SectionCard title="DADOS DE FATURAÇÃO">
            <div className="grid grid-cols-2 gap-2 p-3 lg:grid-cols-4">
              <BillingFieldEditable
                def={FATURACAO_FIELDS[0]}
                order={order}
                editing={editing}
                value={draft[FATURACAO_FIELDS[0].key] ?? ''}
                onChange={(v) => setField(FATURACAO_FIELDS[0].key, v)}
              />
              <BillingFieldEditable
                def={FATURACAO_FIELDS[1]}
                order={order}
                editing={editing}
                value={draft[FATURACAO_FIELDS[1].key] ?? ''}
                onChange={(v) => setField(FATURACAO_FIELDS[1].key, v)}
              />
              <BillingField label="Email do Pedido">{displayText(order.Email)}</BillingField>
              <BillingField label="Customer Contact">{displayText(order.Contacto)}</BillingField>
              <BillingField label="Sell Price">{formatPrice(order.Sell_Price)}</BillingField>
              <BillingField label="Balance to Invoice">{formatPrice(porFaturar)}</BillingField>
              <BillingField label="Status">
                {(() => {
                  const status = invoicingStatus(netInvoiced, order.Sell_Price)
                  return <Badge tone={status.tone}>{status.label}</Badge>
                })()}
              </BillingField>
            </div>
          </SectionCard>

          <DocumentosTable
            order={order}
            rows={docs}
            role={role}
            documentTypes={documentTypes}
            documentTypesPending={documentTypesQuery.isPending}
            documentTypesError={documentTypesError}
            queryError={docsError}
          />

          <SectionCard title="ENVIO POR E-MAIL">
            <div className="grid grid-cols-1 items-center gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <div className="min-w-0">
                <span className="block text-[9px] uppercase text-foreground-muted">
                  Destinatário
                </span>
                <strong className="mt-1 block text-[11px] font-medium text-foreground">
                  {order.Email ? displayText(order.Email) : 'Sem email definido'}
                </strong>
              </div>
              <div className="min-w-0">
                <span className="block text-[9px] uppercase text-foreground-muted">Anexo</span>
                <strong className="mt-1 block text-[11px] font-medium text-foreground">
                  {docs.length > 0 ? 'PDF disponível' : 'Sem PDF disponível'}
                </strong>
              </div>
              <div className="min-w-0">
                <span className="block text-[9px] uppercase text-foreground-muted">Status</span>
                <strong className="mt-1 block text-[11px] font-medium text-foreground">
                  Not sent
                </strong>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" disabled>
                  Pré-visualizar
                </Button>
                <Button size="sm" disabled>
                  Enviar documento
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>
      ),
    },
    ...(order.Kit === true
      ? [
          {
            id: 'kit',
            label: 'Kit',
            content: (
              <div className="space-y-3 pt-3.5">
                <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
                  <EditableMetric
                    def={KIT_FIELDS[1]}
                    order={order}
                    editing={editing}
                    role={role}
                    value={draft[KIT_FIELDS[1].key] ?? ''}
                    onChange={(v) => setField(KIT_FIELDS[1].key, v)}
                    tone="blue"
                    icon={Package}
                    tag="Kit"
                  />
                  <MetricCard
                    tone="green"
                    icon={Wallet}
                    label="Balance"
                    value={formatPrice(kitBalance)}
                    tag="Kit Amount − Consumido"
                  />
                  <MetricCard
                    tone="orange"
                    icon={Receipt}
                    label="Consumido"
                    value={formatPrice(kitConsumedTotal)}
                  />
                </div>
                <KitConsumablesSection
                  order={order}
                  rows={kitConsumables}
                  role={role}
                  queryError={kitConsumablesError}
                />
              </div>
            ),
          },
        ]
      : []),
    {
      id: 'observacoes',
      label: 'Notes',
      content: (
        <div className="space-y-3 pt-3.5">
          <SectionCard title="OBSERVAÇÕES DO PEDIDO">
            <div className="grid grid-cols-1 gap-3.5 p-3 lg:grid-cols-[1fr_280px]">
              <ObservacoesEditor
                key={`${order.ID_Order}:${order.Obs ?? ''}`}
                order={order}
                role={role}
              />

              <aside className="flex flex-col gap-2.5">
                <div className="rounded-md border border-border bg-surface-muted p-2.5">
                  <span className="mb-1.5 block text-[9px] font-extrabold text-foreground/60">
                    ORDER STATUS
                  </span>
                  <div className="flex min-h-[30px] items-center justify-between gap-2 border-t border-border/60 py-1.5 text-[10px] first:border-t-0">
                    <span className="text-foreground-muted">Historical</span>
                    <Badge tone={estado === 'historico' ? 'neutral' : 'success'}>
                      {estado === 'historico' ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex min-h-[30px] items-center justify-between gap-2 border-t border-border/60 py-1.5 text-[10px]">
                    <span className="text-foreground-muted">Month closed</span>
                    <Badge tone={historico ? 'neutral' : 'success'}>
                      {historico ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex min-h-[30px] items-center justify-between gap-2 border-t border-border/60 py-1.5 text-[10px]">
                    <span className="text-foreground-muted">Business closed</span>
                    <Badge tone={order.Negocio_Fechado ? 'success' : 'neutral'}>
                      {order.Negocio_Fechado ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex min-h-[30px] items-center justify-between gap-2 border-t border-border/60 py-1.5 text-[10px]">
                    <span className="text-foreground-muted">Permissão</span>
                    <PermissaoBadge role={role} />
                  </div>
                </div>

                <div className="rounded-md border border-border bg-surface-muted p-2.5">
                  <span className="mb-1.5 block text-[9px] font-extrabold text-foreground/60">
                    REFERÊNCIAS
                  </span>
                  <div className="flex min-h-[30px] items-center justify-between gap-2 border-t border-border/60 py-1.5 text-[10px] first:border-t-0">
                    <span className="text-foreground-muted">ID Order</span>
                    <strong className="text-[10px] font-medium text-foreground">
                      {order.ID_Order}
                    </strong>
                  </div>
                  <div className="flex min-h-[30px] items-center justify-between gap-2 border-t border-border/60 py-1.5 text-[10px]">
                    <span className="text-foreground-muted">PO / Orçamento</span>
                    <strong className="text-[10px] font-medium text-foreground">
                      {displayText(order.Orc_Proposta)}
                    </strong>
                  </div>
                  <div className="flex min-h-[30px] items-center justify-between gap-2 border-t border-border/60 py-1.5 text-[10px]">
                    <span className="text-foreground-muted">Customer PO</span>
                    <strong className="text-[10px] font-medium text-foreground">
                      {displayText(order.PO_Cliente)}
                    </strong>
                  </div>
                </div>
              </aside>
            </div>
          </SectionCard>

          <SectionCard title="HISTÓRICO DE NOTAS">
            <div className="flex min-h-[110px] flex-col items-center justify-center gap-1.5 px-4 py-6 text-center text-foreground/50">
              <span className="text-lg text-foreground/30" aria-hidden>
                ☰
              </span>
              <strong className="text-[11px] font-semibold text-foreground/60">
                Sem histórico de observações
              </strong>
              <span className="max-w-[420px] text-[10px]">
                Alterações futuras podem ser apresentadas aqui quando existir audit trail no
                backend.
              </span>
            </div>
          </SectionCard>
        </div>
      ),
    },
  ]

  return (
    <div className="mx-auto w-full max-w-[1760px] px-6 py-4">
      {/* Header */}
      <div className="mb-3.5 flex items-start justify-between gap-5">
        <div className="min-w-0">
          <h1 className="text-[19px] font-bold leading-tight tracking-tight text-foreground">
            {clientName ?? 'Order'}
          </h1>
          <p className="mt-1.5 flex items-center gap-2 text-xs text-foreground/60">
            Order #{order.ID_Order}
            <span className="text-foreground/30" aria-hidden>
              •
            </span>
            {formatOrderDate(order.DT_Order)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <EstadoBadge estado={estado} />
            <PermissaoBadge role={role} />
            {historico && <Badge tone="neutral">Month closed</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-foreground-muted">
            <span>Permissão</span>
            <Select
              aria-label="Permissão"
              value={role}
              onChange={(e) => roleSwitcher.setRole(e.target.value as 'user' | 'admin')}
              className="h-8 w-28"
            >
              {roleSwitcher.roles.map((r) => (
                <option key={r} value={r}>
                  {r.toUpperCase()}
                </option>
              ))}
            </Select>
          </label>
          <BackButton />
          {canCreate && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/orders/new?clientId=${order.ID_Client ?? ''}`)}
            >
              Novo deste cliente
            </Button>
          )}
          {canEnterEdit && !editing && (
            <Button size="sm" onClick={startEdit}>
              Edit
            </Button>
          )}
          {editing && (
            <>
              <Button size="sm" onClick={save} disabled={mutation.isPending}>
                Save
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={cancelEdit}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {mutation.isError && (
        <div
          role="alert"
          className="mb-3.5 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {mutation.error instanceof Error
            ? mutation.error.message
            : 'Could not save changes.'}
        </div>
      )}

      {/* Two-column workspace: left = caracterização + contactos, right = tabs. */}
      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[364px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <SectionCard title="CARACTERIZAÇÃO DO PEDIDO" bodyClassName="pb-2.5">
            <ReadOnlyRow label="ID Order">{order.ID_Order}</ReadOnlyRow>
            {CARACTERIZACAO_FIELDS.map((def) => {
              // req 4/11: warranty classification fields only apply to warranty
              // order kinds (Type.Warranty = true); omit them entirely otherwise.
              const isWarrantyField =
                def.key === 'ID_Tp_Warranty' || def.key === 'Warranty_DT_Inicio'
              if (isWarrantyField && order.Tipo_Warranty !== true) return null
              // Cascade: Área/Produto/Instrumento dropdowns use the parent-filtered live
              // lists while editing; changing a parent resets its children via the
              // dedicated setters. Other fields use the static config options + setField.
              const optionsOverride =
                def.key === 'ID_Area'
                  ? areasQuery.data
                  : def.key === 'ID_Produto'
                    ? produtoOptions
                    : def.key === 'ID_Instrumento'
                      ? instrumentoOptions
                      : undefined
              const onChange =
                def.key === 'ID_Area'
                  ? setAreaField
                  : def.key === 'ID_Produto'
                    ? setProdutoField
                    : (v: string) => setField(def.key, v)
              return (
                <CaracterizacaoRow
                  key={def.key}
                  def={def}
                  order={order}
                  editing={editing}
                  role={role}
                  value={draft[def.key] ?? ''}
                  onChange={onChange}
                  optionsOverride={optionsOverride}
                />
              )
            })}
            {/* Kit flag — editable for editor/admin (not in the month-locked set).
                Toggling it on/off here gates the Kit tab's visibility after save. */}
            <CaracterizacaoRow
              def={KIT_FIELDS[0]}
              order={order}
              editing={editing}
              role={role}
              value={draft[KIT_FIELDS[0].key] ?? ''}
              onChange={(v) => setField(KIT_FIELDS[0].key, v)}
            />
            <ReadOnlyRow label="Negócio Fechado">
              <Badge tone={order.Negocio_Fechado ? 'success' : 'neutral'}>
                {order.Negocio_Fechado ? 'Yes' : 'No'}
              </Badge>
            </ReadOnlyRow>
          </SectionCard>

          <SectionCard title="CONTACTOS" bodyClassName="pb-1.5">
            <ContactRow label="Email">{displayText(order.Email)}</ContactRow>
            <ContactRow label="Contacto">{displayText(order.Contacto)}</ContactRow>
            <ContactRow label="SAP Order">{displayText(order.Encomenda_Cli_PHC)}</ContactRow>
            <ContactRow label="Fornecedor">{displayText(order.Cod_Enc_Fornecedor)}</ContactRow>
          </SectionCard>
        </div>

        <div className="min-w-0">
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
            <Tabs tabs={tabs} defaultTab="revenue" ariaLabel="Order details" />
          </div>
        </div>
      </div>
    </div>
  )
}
