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
  Pencil,
  Plus,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Trash2,
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
import { useCurrentUser, useRoleSwitcher } from '@/app/providers/user-provider'
import { useRepositories } from '@/app/providers/repository-provider'
import { resolveClientName } from '@/fixtures/orders'
import { formatOrderDate, formatPrice } from '@/utils/format'
import { recognitionTotals, reconhecimentoEstado } from '@/domain/rules/recognition'
import { planMaintenancePropagation, planWarrantyPropagation } from '@/domain/rules/propagation'
import type { Order } from '@/domain/models/order'
import type { OrderUpdatePatch } from '@/services/contracts/orders.repository'
import type { RoleLike } from '@/domain/models/user'
import type { Reconhecimento } from '@/domain/models/reconhecimento'
import type { DocumentoFaturacao } from '@/domain/models/documento-faturacao'
import type { DocumentoFaturacaoType } from '@/services/contracts/documento-faturacao.repository'
import {
  canEditField,
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

/** Em-dash fallback for any null/empty display value. */
const DASH = '—'

function displayText(v: string | null | undefined): string {
  return v && v.length > 0 ? v : DASH
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Editable field definitions                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

type FieldKind = 'text' | 'number' | 'date' | 'select-str' | 'select-num'

interface FieldDef {
  key: keyof OrderUpdatePatch
  label: string
  kind: FieldKind
  options?: readonly ReferenceOption[]
}

/** Caracterização block — the order-classification fields locked after month close. */
const CARACTERIZACAO_FIELDS: readonly FieldDef[] = [
  { key: 'DT_Order', label: 'Data do Pedido', kind: 'date' },
  { key: 'ID_Tp_Order', label: 'Tipo de Pedido', kind: 'select-str', options: orderTypes },
  { key: 'ID_Client', label: 'Cliente', kind: 'number' },
  { key: 'ID_Area', label: 'Área', kind: 'select-str', options: areas },
  { key: 'ID_Tipo', label: 'Tipo', kind: 'select-str', options: tipos },
  { key: 'ID_Produto', label: 'Produto', kind: 'select-num', options: produtos },
  { key: 'ID_Instrumento', label: 'Instrumento', kind: 'select-num', options: instrumentos },
  { key: 'ID_Tp_Warranty', label: 'Garantia', kind: 'select-num', options: warrantyTypes },
  { key: 'Warranty_DT_Inicio', label: 'Início Garantia', kind: 'date' },
  { key: 'ID_Tp_Revenue', label: 'Tipo Revenue', kind: 'select-num', options: revenueTypes },
]

/** Revenue tab — the financial values that drive recognition math. */
const REVENUE_FIELDS: readonly FieldDef[] = [
  { key: 'Sell_Price', label: 'Sell Price', kind: 'number' },
  { key: 'Warranty_Reserve', label: 'Warranty Reserve', kind: 'number' },
]

/** Faturação tab — editable commercial references. */
const FATURACAO_FIELDS: readonly FieldDef[] = [
  { key: 'Orc_Proposta', label: 'Orçamento/Proposta', kind: 'text' },
  { key: 'PO_Cliente', label: 'Pedido do Cliente', kind: 'text' },
]

/** Every field the edit draft tracks. Obs is rendered as a textarea but kept in
 *  the same draft so [Guardar] saves it in one round-trip. */
const ALL_EDITABLE_FIELDS: readonly FieldDef[] = [
  ...CARACTERIZACAO_FIELDS,
  ...REVENUE_FIELDS,
  ...FATURACAO_FIELDS,
  { key: 'Obs', label: 'Observações', kind: 'text' },
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

/** Seed the draft from the order so each input shows its current value. */
function seedDraft(order: Order): Draft {
  const draft: Draft = {}
  for (const def of ALL_EDITABLE_FIELDS) {
    const v = order[def.key]
    if (def.kind === 'date') draft[def.key] = v ? String(v).slice(0, 10) : ''
    else draft[def.key] = v == null ? '' : String(v)
  }
  return draft
}

/** Parse a raw draft string back to the field's wire type. */
function parseValue(def: FieldDef, raw: string): unknown {
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

function EstadoBadge({ estado }: { estado: OrderEstado }) {
  const map: Record<OrderEstado, { tone: 'neutral' | 'success' | 'warning'; label: string }> = {
    provisorio: { tone: 'warning', label: 'Provisório' },
    historico: { tone: 'neutral', label: 'Histórico' },
    atual: { tone: 'success', label: 'Atual' },
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
  if (def.kind === 'select-str' || def.kind === 'select-num') {
    return displayText(optionLabel(def.options!, v as string | number | null))
  }
  if (def.key === 'ID_Client') {
    return displayText(order.Client_Name ?? resolveClientName(order.ID_Client))
  }
  if (def.key === 'Sell_Price' || def.key === 'Warranty_Reserve') {
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
}: {
  def: FieldDef
  value: string
  disabled: boolean
  onChange: (v: string) => void
}) {
  const common = {
    value,
    disabled,
    'aria-label': def.label,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange(e.target.value),
  }
  if (def.kind === 'select-str' || def.kind === 'select-num') {
    return (
      <Select {...common}>
        <option value="">—</option>
        {def.options!.map((o) => (
          <option key={String(o.id)} value={String(o.id)}>
            {o.label}
          </option>
        ))}
      </Select>
    )
  }
  if (def.kind === 'number') return <Input type="number" {...common} />
  if (def.kind === 'date') return <Input type="date" {...common} />
  return <Input type="text" {...common} />
}

/** A small lock glyph shown beside a field label when the role can't edit it.
 *  The aria-label is pinned by the test suite. */
function LockIcon() {
  return (
    <Lock
      className="size-3 shrink-0 text-foreground/40"
      aria-label="Campo bloqueado (mês fechado)"
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
}: {
  def: FieldDef
  order: Order
  editing: boolean
  role: RoleLike
  value: string
  onChange: (v: string) => void
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
          <FieldControl def={def} value={value} disabled={locked} onChange={onChange} />
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
    years: '1',
  })

  const canAdd = role !== 'viewer'

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
        `Valor inválido. Disponível: ${formatPrice(capacity)}. O total reconhecido não pode ultrapassar o Sell Price.`,
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
        reason instanceof Error ? reason.message : 'Não foi possível adicionar o reconhecimento.',
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
        `Valor inválido. Disponível: ${formatPrice(cap)}. O total reconhecido não pode ultrapassar o Sell Price.`,
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
          setError(e instanceof Error ? e.message : 'Não foi possível guardar o reconhecimento.'),
      },
    )
  }

  function handleDelete(r: Reconhecimento) {
    if (!window.confirm(`Apagar este reconhecimento de ${formatPrice(r.Valor_Reconhecimento)}?`))
      return
    deleteMutation.mutate(
      { id: r.ID_Reconhecimento },
      {
        onError: (e) =>
          setError(e instanceof Error ? e.message : 'Não foi possível apagar o reconhecimento.'),
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
    isContract && contractOpen && contractYearsValid && contractForm.startDate
      ? planMaintenancePropagation(order, contractForm.startDate, contractYears)
      : []

  function handlePropagateWarranty() {
    const monthly = warrantyPlan[0]?.value ?? 0
    if (
      !window.confirm(
        `Propagar ${warrantyPlan.length} reconhecimentos de garantia (WP) de ${formatPrice(monthly)}/mês, a partir de ${formatOrderDate(
          warrantyPlan[0]?.date ?? null,
        )}? Total: ${formatPrice(warrantyPlan.reduce((s, l) => s + l.value, 0))}.`,
      )
    )
      return
    setError(null)
    propagateMutation.mutate(
      { kind: 'warranty' },
      {
        onError: (e) =>
          setError(
            e instanceof Error
              ? e.message
              : 'Não foi possível propagar os reconhecimentos de garantia.',
          ),
      },
    )
  }

  function handlePropagateContract() {
    setError(null)
    const years = Number(contractForm.years)
    if (!contractForm.startDate || !Number.isInteger(years) || years < 1 || years > 100) {
      setError('Indique o início do contrato e um nº de anos inteiro entre 1 e 100.')
      return
    }
    const preview = planMaintenancePropagation(order, contractForm.startDate, years)
    if (
      !window.confirm(
        `Propagar ${preview.length} reconhecimentos de manutenção (CM) de ${formatPrice(preview[0]?.value ?? 0)}/mês, a partir de ${formatOrderDate(
          preview[0]?.date ?? null,
        )}? Total: ${formatPrice(preview.reduce((s, l) => s + l.value, 0))}.`,
      )
    )
      return
    propagateMutation.mutate(
      { kind: 'maintenance', startDate: contractForm.startDate, years },
      {
        onSuccess: () => setContractOpen(false),
        onError: (e) =>
          setError(
            e instanceof Error
              ? e.message
              : 'Não foi possível propagar os reconhecimentos de manutenção.',
          ),
      },
    )
  }

  const propagateActions = (
    <div className="flex flex-wrap items-center gap-2">
      {canPropagateWarranty && canAdd && (
        <Button
          size="sm"
          variant="secondary"
          onClick={handlePropagateWarranty}
          disabled={propagateMutation.isPending}
        >
          <Sparkles className="size-4" aria-hidden /> Propagar garantia
        </Button>
      )}
      {isContract && canAdd && !contractOpen && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setContractOpen(true)}
          disabled={propagateMutation.isPending}
        >
          <Sparkles className="size-4" aria-hidden /> Propagar contrato
        </Button>
      )}
    </div>
  )

  return (
    <SectionCard
      title="RECONHECIMENTOS"
      action={
        <div className="flex flex-wrap items-center gap-2">
          {propagateActions}
          {canAdd && !adding && (
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden /> Adicionar Reconhecimento
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
            Início do contrato
            <Input
              type="date"
              aria-label="Início do contrato"
              value={contractForm.startDate}
              onChange={(e) => setContractForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-foreground-muted">
            Nº de anos
            <Input
              type="number"
              aria-label="Nº de anos do contrato"
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
            Propagar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setContractOpen(false)}
            disabled={propagateMutation.isPending}
          >
            Cancelar
          </Button>
          {contractPlan.length > 0 && (
            <span className="text-[10px] text-foreground/60">
              {contractPlan.length} linhas de {formatPrice(contractPlan[0].value)}/mês • total{' '}
              {formatPrice(contractPlan.reduce((s, l) => s + l.value, 0))}
            </span>
          )}
        </div>
      )}
      {adding && (
        <div className="flex flex-wrap items-end gap-2 border-b border-border bg-surface-muted p-3">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-foreground-muted">
            Tipo
            <Select
              aria-label="Tipo de reconhecimento"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {tpReconhecimentos.map((o) => (
                <option key={String(o.id)} value={String(o.id)}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-foreground-muted">
            Data
            <Input
              type="date"
              aria-label="Data do reconhecimento"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-foreground-muted">
            Valor
            <Input
              type="number"
              aria-label="Valor do reconhecimento"
              value={form.value}
              min="0"
              max={capacity}
              step="0.01"
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            />
          </label>
          <Button size="sm" onClick={handleAdd} disabled={saving}>
            Adicionar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={saving}>
            Cancelar
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
          Sem reconhecimentos.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-[10px] uppercase text-foreground-muted">
                <th className="px-2.5 py-1.5 font-semibold">Tipo</th>
                <th className="px-2.5 py-1.5 font-semibold">Data do Reconhecimento</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Valor</th>
                <th className="px-2.5 py-1.5 font-semibold">Estado</th>
                {canAdd && <th className="px-2.5 py-1.5 text-right font-semibold">Ações</th>}
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
                          aria-label="Tipo de reconhecimento"
                          value={editForm.type}
                          onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                        >
                          {tpReconhecimentos.map((o) => (
                            <option key={String(o.id)} value={String(o.id)}>
                              {o.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="date"
                          aria-label="Data do reconhecimento"
                          value={editForm.date}
                          onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="number"
                          aria-label="Valor do reconhecimento"
                          value={editForm.value}
                          min="0"
                          step="0.01"
                          onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))}
                        />
                      </td>
                      <td className="px-2.5 py-1.5" />
                      <td className="px-2.5 py-1.5 text-right">
                        <Button
                          size="sm"
                          onClick={() => saveEditRow(r)}
                          disabled={updateMutation.isPending}
                        >
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          disabled={updateMutation.isPending}
                        >
                          Cancelar
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
                    {canAdd && (
                      <td className="px-2.5 py-1.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Editar linha de reconhecimento ${r.ID_Reconhecimento}`}
                            onClick={() => startEditRow(r)}
                            disabled={updateMutation.isPending || deleteMutation.isPending}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Apagar linha de reconhecimento ${r.ID_Reconhecimento}`}
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
    if (!Number.isFinite(value)) return 'Valor inválido.'
    if (sellPrice != null && otherNet + value > sellPrice + 0.005) {
      return `O net faturado não pode ultrapassar o Sell Price (${formatPrice(sellPrice)}).`
    }
    return null
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
      setError(reason instanceof Error ? reason.message : 'Não foi possível adicionar o documento.')
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
          setError(e instanceof Error ? e.message : 'Não foi possível guardar o documento.'),
      },
    )
  }

  function handleDelete(d: DocumentoFaturacao) {
    if (!window.confirm(`Apagar o documento ${displayText(d.N_Doc_FT)}?`)) return
    deleteMutation.mutate(
      { id: d.ID_Facturacao },
      {
        onError: (e) =>
          setError(e instanceof Error ? e.message : 'Não foi possível apagar o documento.'),
      },
    )
  }

  return (
    <SectionCard
      title="DOCUMENTOS FATURADOS"
      action={
        canAdd && !adding && documentTypes.length > 0 ? (
          <Button size="sm" variant="secondary" onClick={startAdd}>
            <Plus className="size-4" aria-hidden /> Adicionar documento
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
      {adding && (
        <div className="flex flex-wrap items-end gap-2 border-b border-border bg-surface-muted p-3">
          <Input
            aria-label="Data do documento"
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
          <Select
            aria-label="Tipo de documento"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            {documentTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </Select>
          <Input
            aria-label="Número do documento"
            placeholder="Nº documento"
            value={form.number}
            onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
          />
          <Input
            aria-label="Valor do documento"
            type="number"
            step="0.01"
            value={form.value}
            onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
          />
          <Button size="sm" onClick={handleAdd} disabled={saving}>
            Adicionar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={saving}>
            Cancelar
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
          Sem documentos.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-[10px] uppercase text-foreground-muted">
                <th className="px-2.5 py-1.5 font-semibold">Data</th>
                <th className="px-2.5 py-1.5 font-semibold">Documento</th>
                <th className="px-2.5 py-1.5 font-semibold">Nº</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Valor</th>
                {canAdd && <th className="px-2.5 py-1.5 text-right font-semibold">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                if (editingId === d.ID_Facturacao) {
                  return (
                    <tr
                      key={d.ID_Facturacao}
                      className="border-b border-border/50 bg-surface-muted"
                    >
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="date"
                          aria-label="Data do documento"
                          value={editForm.date}
                          onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Select
                          aria-label="Tipo de documento"
                          value={editForm.type}
                          onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
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
                          aria-label="Número do documento"
                          value={editForm.number}
                          onChange={(e) => setEditForm((f) => ({ ...f, number: e.target.value }))}
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          aria-label="Valor do documento"
                          value={editForm.value}
                          onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))}
                        />
                      </td>
                      <td className="px-2.5 py-1.5 text-right">
                        <Button
                          size="sm"
                          onClick={() => saveEditRow(d)}
                          disabled={updateMutation.isPending}
                        >
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          disabled={updateMutation.isPending}
                        >
                          Cancelar
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
                    {canAdd && (
                      <td className="px-2.5 py-1.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Editar linha de documento ${d.ID_Facturacao}`}
                            onClick={() => startEditRow(d)}
                            disabled={updateMutation.isPending || deleteMutation.isPending}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Apagar linha de documento ${d.ID_Facturacao}`}
                            onClick={() => handleDelete(d)}
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
        aria-label="Observações"
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
          Guardar observações
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
      Voltar
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

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>({})

  const estado = useMemo(() => orderEstado(order), [order])
  const historico = useMemo(() => isHistorico(order), [order])
  const clientName = order.Client_Name ?? resolveClientName(order.ID_Client)

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

  // Recognition split (req 9): the warranty vs instrument bucket math lives in the
  // pure `recognitionTotals` helper so it stays identical in mock and HTTP repos and
  // is unit-tested. "Instrumento por Reconhecer" = (Sell_Price − Warranty_Reserve) −
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
  // req 6: green highlight on "Total Reconhecido" when it reaches Sell_Price.
  const fullyRecognized =
    order.Sell_Price != null &&
    order.Sell_Price > 0 &&
    Math.abs(totalReconhecido - order.Sell_Price) <= 0.005

  const docs = docsQuery.data ?? []
  const documentTypes = documentTypesQuery.data ?? []
  const documentTypesError = documentTypesQuery.isError
    ? documentTypesQuery.error instanceof Error
      ? documentTypesQuery.error.message
      : 'Não foi possível carregar os tipos de documento.'
    : null
  const recoError = recoQuery.isError
    ? recoQuery.error instanceof Error
      ? recoQuery.error.message
      : 'Não foi possível carregar os reconhecimentos.'
    : null
  const docsError = docsQuery.isError
    ? docsQuery.error instanceof Error
      ? docsQuery.error.message
      : 'Não foi possível carregar os documentos faturados.'
    : null
  const netInvoiced = docs.reduce((sum, d) => sum + (d.Valor_Doc_FT ?? 0), 0)
  const porFaturar = (order.Sell_Price ?? 0) - netInvoiced

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
        label="Instrumento Reconhecido"
        value={formatPrice(instrumentReconhecido)}
      />
      <MetricCard
        tone="orange"
        icon={Clock}
        label="Instrumento por Reconhecer"
        value={formatPrice(instrumentPorReconhecer)}
      />
      {/* Warranty KPIs only apply to warranty order kinds (req 11). */}
      {order.Tipo_Warranty === true && (
        <>
          <MetricCard
            tone="green"
            icon={ShieldCheck}
            label="Garantia Reconhecida"
            value={formatPrice(warrantyReconhecido)}
          />
          <MetricCard
            tone="orange"
            icon={ShieldAlert}
            label="Garantia por Reconhecer"
            value={formatPrice(warrantyPorReconhecer)}
          />
        </>
      )}
      <MetricCard
        tone="blue"
        icon={TrendingUp}
        label="Total Reconhecido"
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
      label: 'Faturação',
      content: (
        <div className="space-y-3 pt-3.5">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            <MetricCard
              tone="orange"
              icon={Receipt}
              label="Por Faturar"
              value={formatPrice(porFaturar)}
            />
            <MetricCard
              tone="green"
              icon={FileText}
              label="Documentos Emitidos"
              value={String(docs.length)}
            />
            <MetricCard tone="purple" icon={Mail} label="Estado E-Mail" value="Não enviado" />
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
              <BillingField label="Contacto Cliente">{displayText(order.Contacto)}</BillingField>
              <BillingField label="Sell Price">{formatPrice(order.Sell_Price)}</BillingField>
              <BillingField label="Saldo por Faturar">{formatPrice(porFaturar)}</BillingField>
              <BillingField label="Estado">
                <Badge tone={order.Facturado ? 'success' : 'neutral'}>
                  {order.Facturado ? 'Faturado' : 'Não faturado'}
                </Badge>
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
                <span className="block text-[9px] uppercase text-foreground-muted">Estado</span>
                <strong className="mt-1 block text-[11px] font-medium text-foreground">
                  Não enviado
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
    {
      id: 'observacoes',
      label: 'Observações',
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
                    ESTADO DO PEDIDO
                  </span>
                  <div className="flex min-h-[30px] items-center justify-between gap-2 border-t border-border/60 py-1.5 text-[10px] first:border-t-0">
                    <span className="text-foreground-muted">Histórico</span>
                    <Badge tone={estado === 'historico' ? 'neutral' : 'success'}>
                      {estado === 'historico' ? 'Sim' : 'Não'}
                    </Badge>
                  </div>
                  <div className="flex min-h-[30px] items-center justify-between gap-2 border-t border-border/60 py-1.5 text-[10px]">
                    <span className="text-foreground-muted">Mês fechado</span>
                    <Badge tone={historico ? 'neutral' : 'success'}>
                      {historico ? 'Sim' : 'Não'}
                    </Badge>
                  </div>
                  <div className="flex min-h-[30px] items-center justify-between gap-2 border-t border-border/60 py-1.5 text-[10px]">
                    <span className="text-foreground-muted">Negócio fechado</span>
                    <Badge tone={order.Negocio_Fechado ? 'success' : 'neutral'}>
                      {order.Negocio_Fechado ? 'Sim' : 'Não'}
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
                    <span className="text-foreground-muted">Pedido Cliente</span>
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
            {historico && <Badge tone="neutral">Mês fechado</Badge>}
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
              Editar
            </Button>
          )}
          {editing && (
            <>
              <Button size="sm" onClick={save} disabled={mutation.isPending}>
                Guardar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={cancelEdit}
                disabled={mutation.isPending}
              >
                Cancelar
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
            : 'Não foi possível guardar as alterações.'}
        </div>
      )}

      {/* Two-column workspace: left = caracterização + contactos, right = tabs. */}
      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[364px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <SectionCard title="CARACTERIZAÇÃO DO PEDIDO" bodyClassName="pb-2.5">
            <ReadOnlyRow label="ID Order">{order.ID_Order}</ReadOnlyRow>
            {CARACTERIZACAO_FIELDS.map((def) => {
              // req 4/11: warranty classification fields only apply to warranty
              // order kinds (Tipo.Warranty = true); omit them entirely otherwise.
              const isWarrantyField =
                def.key === 'ID_Tp_Warranty' || def.key === 'Warranty_DT_Inicio'
              if (isWarrantyField && order.Tipo_Warranty !== true) return null
              return (
                <CaracterizacaoRow
                  key={def.key}
                  def={def}
                  order={order}
                  editing={editing}
                  role={role}
                  value={draft[def.key] ?? ''}
                  onChange={(v) => setField(def.key, v)}
                />
              )
            })}
            <ReadOnlyRow label="Negócio Fechado">
              <Badge tone={order.Negocio_Fechado ? 'success' : 'neutral'}>
                {order.Negocio_Fechado ? 'Sim' : 'Não'}
              </Badge>
            </ReadOnlyRow>
          </SectionCard>

          <SectionCard title="CONTACTOS" bodyClassName="pb-1.5">
            <ContactRow label="Email">{displayText(order.Email)}</ContactRow>
            <ContactRow label="Contacto">{displayText(order.Contacto)}</ContactRow>
            <ContactRow label="Encomenda PHC">{displayText(order.Encomenda_Cli_PHC)}</ContactRow>
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
