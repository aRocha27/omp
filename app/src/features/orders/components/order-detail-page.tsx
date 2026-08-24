import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  Clock,
  FileText,
  Lock,
  Mail,
  Plus,
  Receipt,
  ShoppingCart,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useOrder } from '@/features/orders/api/use-order'
import { useUpdateOrder } from '@/features/orders/api/use-update-order'
import { useReconhecimentos } from '@/features/orders/api/use-reconhecimentos'
import { useDocumentoFaturacao } from '@/features/orders/api/use-documento-faturacao'
import { useCurrentUser, useRoleSwitcher } from '@/app/providers/user-provider'
import { useRepositories } from '@/app/providers/repository-provider'
import { resolveClientName } from '@/fixtures/orders'
import { formatOrderDate, formatPrice } from '@/utils/format'
import type { Order } from '@/domain/models/order'
import type { OrderUpdatePatch } from '@/services/contracts/orders.repository'
import type { RoleLike } from '@/domain/models/user'
import type { Reconhecimento } from '@/domain/models/reconhecimento'
import type { DocumentoFaturacao } from '@/domain/models/documento-faturacao'
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
import { reconhecimentoLabel, docFtLabel } from '@/features/orders/components/reference-labels'
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
 *  `getByText('Sell Price')` resolves to exactly this element. */
function MetricCard({
  tone,
  icon: Icon,
  label,
  value,
  tag,
}: {
  tone: MetricTone
  icon: LucideIcon
  label: string
  value: ReactNode
  tag?: string
}) {
  return (
    <div className="flex min-h-[66px] items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5">
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
    <section className={`overflow-hidden rounded-lg border border-border bg-surface shadow-sm ${className ?? ''}`}>
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
      <span className="block text-[9px] uppercase tracking-wide text-foreground-muted">{label}</span>
      <span className="mt-1 block text-[11px] font-medium text-foreground">{children}</span>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Sub-tables                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function ReconhecimentosSection({
  orderId,
  rows,
  role,
  sellPrice,
  warrantyReserve,
}: {
  orderId: number
  rows: Reconhecimento[]
  role: RoleLike
  sellPrice: number | null
  warrantyReserve: number | null
}) {
  const { reconhecimentos } = useRepositories()
  const queryClient = useQueryClient()
  const user = useCurrentUser()
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ type: 'P', date: new Date().toISOString().slice(0, 10), value: '' })

  const canAdd = role !== 'viewer'
  const isWarranty = form.type === 'W' || form.type === 'WP'
  const alreadyRecognized = rows
    .filter((row) => (row.ID_Tp_Reconhecimento === 'W' || row.ID_Tp_Reconhecimento === 'WP') === isWarranty)
    .reduce((sum, row) => sum + (row.Valor_Reconhecimento ?? 0), 0)
  const capacity = Math.max(
    0,
    (isWarranty ? warrantyReserve ?? 0 : (sellPrice ?? 0) - (warrantyReserve ?? 0)) - alreadyRecognized,
  )

  async function handleAdd() {
    setError(null)
    const value = Number(form.value)
    if (!Number.isFinite(value) || value <= 0 || value > capacity + 0.0001) {
      setError(`Valor inválido. Disponível: ${formatPrice(capacity)}.`)
      return
    }
    setSaving(true)
    try {
      await reconhecimentos.add({
        ID_Order: orderId,
        ID_Tp_Reconhecimento: form.type || null,
        DT_Reconhecimento: form.date ? new Date(form.date).toISOString() : null,
        Valor_Reconhecimento: form.value === '' ? null : Number(form.value),
        ID_User: String(user.ID_User),
      }, role)
      await queryClient.invalidateQueries({ queryKey: ['orders', 'reconhecimentos', orderId] })
      setAdding(false)
      setForm({ type: 'P', date: new Date().toISOString().slice(0, 10), value: '' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível adicionar o reconhecimento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard
      title="RECONHECIMENTOS"
      action={
        canAdd && !adding ? (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden /> Adicionar Reconhecimento
          </Button>
        ) : undefined
      }
    >
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
      {error && <p role="alert" className="border-b border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

      {rows.length === 0 ? (
        <p className="m-3 rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-foreground/50">
          Sem reconhecimentos.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-[10px] uppercase text-foreground-muted">
                <th className="px-2.5 py-1.5 font-semibold">Tipo</th>
                <th className="px-2.5 py-1.5 font-semibold">Data do Reconhecimento</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Valor</th>
                <th className="px-2.5 py-1.5 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
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
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] text-foreground/70">
                      <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                      Por reconhecer
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

function DocumentosTable({ rows, orderId, role }: { rows: DocumentoFaturacao[]; orderId?: number; role?: RoleLike }) {
  const { facturacao } = useRepositories()
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), type: 'FT', number: '', value: '' })
  const netInvoiced = rows.reduce((sum, d) => sum + (d.Valor_Doc_FT ?? 0), 0)
  const canAdd = orderId !== undefined && role !== 'viewer'
  async function handleAdd() {
    if (!orderId || !form.number || form.value === '') return
    setSaving(true); setError(null)
    try {
      await facturacao.add({ ID_Order: orderId, DT_Doc_FT: new Date(form.date).toISOString(), ID_Tp_Doc_FT: form.type, N_Doc_FT: form.number, Valor_Doc_FT: Number(form.value), ID_User: String(user.ID_User) }, role)
      await queryClient.invalidateQueries({ queryKey: ['orders', 'facturacao', orderId] })
      setAdding(false); setForm({ date: new Date().toISOString().slice(0, 10), type: 'FT', number: '', value: '' })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível adicionar o documento.') } finally { setSaving(false) }
  }
  return (
    <SectionCard title="DOCUMENTOS FATURADOS" action={canAdd && !adding ? <Button size="sm" variant="secondary" onClick={() => setAdding(true)}><Plus className="size-4" /> Adicionar documento</Button> : undefined}>
      {adding && <div className="flex flex-wrap items-end gap-2 border-b border-border bg-surface-muted p-3">
        <Input aria-label="Data do documento" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        <Select aria-label="Tipo de documento" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}><option value="FT">FT</option><option value="NC">NC</option><option value="ND">ND</option></Select>
        <Input aria-label="Número do documento" placeholder="Nº documento" value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} />
        <Input aria-label="Valor do documento" type="number" step="0.01" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
        <Button size="sm" onClick={handleAdd} disabled={saving}>Adicionar</Button>
        <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={saving}>Cancelar</Button>
      </div>}
      {error && <p role="alert" className="border-b border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
      {rows.length === 0 ? (
        <p className="m-3 rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-foreground/50">
          Sem documentos.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-[10px] uppercase text-foreground-muted">
                <th className="px-2.5 py-1.5 font-semibold">Data</th>
                <th className="px-2.5 py-1.5 font-semibold">Documento</th>
                <th className="px-2.5 py-1.5 font-semibold">Nº</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.ID_Facturacao} className="border-b border-border/50">
                  <td className="px-2.5 py-1.5 text-[11px]">{formatOrderDate(d.DT_Doc_FT)}</td>
                  <td className="px-2.5 py-1.5 text-[11px]">
                    {displayText(docFtLabel(d.ID_Tp_Doc_FT))}
                  </td>
                  <td className="px-2.5 py-1.5 text-[11px]">{displayText(d.N_Doc_FT)}</td>
                  <td className="px-2.5 py-1.5 text-right text-[11px]">
                    {formatPrice(d.Valor_Doc_FT)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-foreground/60">
                <td className="px-2.5 py-1.5 text-[11px] font-semibold" colSpan={3}>
                  Net faturado
                </td>
                <td className="px-2.5 py-1.5 text-right text-[11px] font-semibold">
                  {formatPrice(netInvoiced)}
                </td>
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
  useEffect(() => setValue(order.Obs ?? ''), [order.Obs])
  const canSave = role !== 'viewer'
  function save() {
    if (!canSave || value === (order.Obs ?? '')) return
    mutation.mutate({ id: order.ID_Order, patch: { Obs: value || null } })
  }
  return <div className="p-3">
    <textarea aria-label="Observações" disabled={!canSave || mutation.isPending} value={value} onChange={(event) => setValue(event.target.value)} className="min-h-48 w-full resize-y rounded-md border border-border bg-surface p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" />
    {mutation.isError && <p role="alert" className="mt-2 text-xs text-danger">{mutation.error.message}</p>}
    <div className="mt-2 flex justify-end"><Button size="sm" onClick={save} disabled={!canSave || mutation.isPending || value === (order.Obs ?? '')}>Guardar observações</Button></div>
  </div>
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
  const { data: order, isPending, isError, error } = useOrder(
    Number.isNaN(orderId) ? null : orderId,
  )

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

  // Recognition split: warranty codes (W/WP) feed the Warranty bucket, everything
  // else (CM/P/T) feeds the Instrument bucket.
  const recos = recoQuery.data ?? []
  const warrantyCodes = new Set<string>(['W', 'WP'])
  const instrumentReconhecido = recos
    .filter((r) => !warrantyCodes.has(r.ID_Tp_Reconhecimento ?? ''))
    .reduce((s, r) => s + (r.Valor_Reconhecimento ?? 0), 0)
  const warrantyReconhecido = recos
    .filter((r) => warrantyCodes.has(r.ID_Tp_Reconhecimento ?? ''))
    .reduce((s, r) => s + (r.Valor_Reconhecimento ?? 0), 0)
  const instrumentPorReconhecer = (order.Sell_Price ?? 0) - instrumentReconhecido
  const warrantyPorReconhecer = (order.Warranty_Reserve ?? 0) - warrantyReconhecido
  const totalReconhecido = instrumentReconhecido + warrantyReconhecido

  const docs = docsQuery.data ?? []
  const netInvoiced = docs.reduce((sum, d) => sum + (d.Valor_Doc_FT ?? 0), 0)
  const porFaturar = (order.Sell_Price ?? 0) - netInvoiced

  const canEnterEdit = role !== 'viewer' && (!historico || role === 'admin' || role === 'editor')
  const canCreate = role !== 'viewer'

  const revenueMetrics = (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
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
      <MetricCard
        tone="blue"
        icon={TrendingUp}
        label="Total Reconhecido"
        value={formatPrice(totalReconhecido)}
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
           <ReconhecimentosSection orderId={order.ID_Order} rows={recos} role={role} sellPrice={order.Sell_Price} warrantyReserve={order.Warranty_Reserve} />
           <DocumentosTable orderId={order.ID_Order} role={role} rows={docs} />
        </div>
      ),
    },
    {
      id: 'faturacao',
      label: 'Faturação',
      content: (
        <div className="space-y-3 pt-3.5">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            <MetricCard tone="orange" icon={Receipt} label="Por Faturar" value={formatPrice(porFaturar)} />
            <MetricCard tone="green" icon={FileText} label="Documentos Emitidos" value={String(docs.length)} />
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

           <DocumentosTable orderId={order.ID_Order} role={role} rows={docs} />

          <SectionCard title="ENVIO POR E-MAIL">
            <div className="grid grid-cols-1 items-center gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
              <div className="min-w-0">
                <span className="block text-[9px] uppercase text-foreground-muted">Destinatário</span>
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
              <ObservacoesEditor order={order} role={role} />

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
                    <Badge tone={historico ? 'neutral' : 'success'}>{historico ? 'Sim' : 'Não'}</Badge>
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
                Alterações futuras podem ser apresentadas aqui quando existir audit trail no backend.
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
            <Button size="sm" variant="secondary" onClick={() => navigate(`/orders/new?clientId=${order.ID_Client ?? ''}`)}>
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
              <Button size="sm" variant="secondary" onClick={cancelEdit} disabled={mutation.isPending}>
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
            {CARACTERIZACAO_FIELDS.map((def) => (
              <CaracterizacaoRow
                key={def.key}
                def={def}
                order={order}
                editing={editing}
                role={role}
                value={draft[def.key] ?? ''}
                onChange={(v) => setField(def.key, v)}
              />
            ))}
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
