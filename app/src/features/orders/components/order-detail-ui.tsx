import type { ChangeEvent, ReactNode } from 'react'
import { Lock, type LucideIcon } from 'lucide-react'
import { resolveClientName } from '@/fixtures/orders'
import { formatOrderDate, formatPrice } from '@/utils/format'
import type { Order } from '@/domain/models/order'
import type { ClientSummary } from '@/domain/models/client'
import type { RoleLike } from '@/domain/models/user'
import { canEditField, type OrderEstado } from '@/domain/orders/order-policy'
import type { ReferenceOption } from '@/fixtures/reference-data'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import { displayText } from '@/components/ui/display-text'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { FieldDef } from '@/features/orders/components/order-detail-edit-model'

export function EstadoBadge({ estado }: { estado: OrderEstado }) {
  const map: Record<OrderEstado, { tone: 'neutral' | 'success' | 'warning'; label: string }> = {
    provisorio: { tone: 'warning', label: 'Provisional' },
    historico: { tone: 'neutral', label: 'Historical' },
    current: { tone: 'success', label: 'Current' },
  }
  const { tone, label } = map[estado]
  return <Badge tone={tone}>{label}</Badge>
}

export function PermissaoBadge({ role }: { role: RoleLike }) {
  const map: Record<RoleLike, { tone: 'neutral' | 'success' | 'warning'; label: string }> = {
    user: { tone: 'success', label: 'USER' },
    viewer: { tone: 'neutral', label: 'Viewer' },
    editor: { tone: 'success', label: 'Editor' },
    admin: { tone: 'warning', label: 'ADMIN' },
  }
  const { tone, label } = map[role]
  return <Badge tone={tone}>{label}</Badge>
}

type MetricTone = 'blue' | 'green' | 'orange' | 'purple'

const TONE_CHIP: Record<MetricTone, string> = {
  blue: 'bg-primary/10 text-primary',
  green: 'bg-success/10 text-success',
  orange: 'bg-warning/10 text-warning',
  purple: 'bg-violet/10 text-violet',
}

export function MetricCard({
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

export function SectionCard({
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
      className={`overflow-x-hidden rounded-lg border border-border bg-surface shadow-sm ${className ?? ''}`}
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

function viewValue(def: FieldDef, order: Order): ReactNode {
  const v = order[def.key]
  if (def.kind === 'boolean') return v === true ? 'Yes' : 'No'
  if (def.kind === 'select-str' || def.kind === 'select-num') {
    const canonical =
      def.key === 'ID_Tp_Order'
        ? order.Tp_Order_Label
        : def.key === 'ID_Area'
          ? order.Area_Label
          : def.key === 'ID_Tipo'
            ? order.Tipo_Label
            : def.key === 'ID_Produto'
              ? order.Produto_Label
              : def.key === 'ID_Instrumento'
                ? order.Instrumento_Label
                : def.key === 'ID_Tp_Warranty'
                  ? order.Tp_Warranty_Label
                  : def.key === 'ID_Tp_Revenue'
                    ? order.Tp_Revenue_Label
                    : undefined
    if (canonical !== undefined) return displayText(canonical)
    return displayText(optionLabel(def.options!, v as string | number | null))
  }
  if (def.key === 'ID_Client')
    return displayText(order.Client_Name ?? resolveClientName(order.ID_Client))
  if (def.key === 'Sell_Price' || def.key === 'Warranty_Reserve' || def.key === 'Kit_Amount') {
    return formatPrice(v as number | null)
  }
  if (def.kind === 'date') return formatOrderDate(v as string | null)
  return displayText(v as string | null)
}

function optionLabel(options: readonly ReferenceOption[], id: string | number | null | undefined) {
  if (id === null || id === undefined) return null
  const match = options.find((o) => String(o.id) === String(id))
  return match ? match.label : null
}

export function FieldControl({
  def,
  value,
  disabled,
  onChange,
  optionsOverride,
  clientOptions,
}: {
  def: FieldDef
  value: string
  disabled: boolean
  onChange: (v: string) => void
  optionsOverride?: readonly ReferenceOption[]
  clientOptions?: readonly ClientSummary[]
}) {
  const common = {
    value,
    disabled,
    'aria-label': def.label,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange(e.target.value),
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
  if (def.kind === 'client') {
    return (
      <Select {...common}>
        <option value="">—</option>
        {(clientOptions ?? []).map((client) => (
          <option key={client.ID_Cliente} value={String(client.ID_Cliente)}>
            {client.nome ?? `Client ${client.ID_Cliente}`}
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

export function LockIcon() {
  return (
    <Lock className="size-3 shrink-0 text-foreground/40" aria-label="Field locked (month closed)" />
  )
}

export function CaracterizacaoRow({
  def,
  order,
  editing,
  role,
  value,
  onChange,
  optionsOverride,
  clientOptions,
}: {
  def: FieldDef
  order: Order
  editing: boolean
  role: RoleLike
  value: string
  onChange: (v: string) => void
  optionsOverride?: readonly ReferenceOption[]
  clientOptions?: readonly ClientSummary[]
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
            clientOptions={clientOptions}
          />
        ) : (
          viewValue(def, order)
        )}
      </dd>
    </div>
  )
}

export function ReadOnlyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-center gap-2 px-2.5 py-1.5">
      <dt className="text-[10px] text-foreground-muted">{label}</dt>
      <dd className="min-w-0 text-[11px] font-medium text-foreground">{children}</dd>
    </div>
  )
}

export function ContactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2 border-t border-border/60 px-2.5 py-1.5 text-[10px]">
      <span className="text-foreground-muted">{label}</span>
      <span className="font-medium text-foreground">{children}</span>
    </div>
  )
}

export function EditableMetric({
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

export function BillingFieldEditable({
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
    <div className="min-h-[58px] rounded-md border border-border bg-surface-muted p-2.5">
      <span className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-foreground-muted">
        <span>{def.label}</span>
        {locked && <LockIcon />}
      </span>
      <div className="mt-1 text-[11px] font-medium text-foreground">
        {editing ? (
          <FieldControl def={def} value={value} disabled={locked} onChange={onChange} />
        ) : (
          viewValue(def, order)
        )}
      </div>
    </div>
  )
}

export function BillingField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-h-[58px] rounded-md border border-border bg-surface-muted p-2.5">
      <span className="block text-[9px] uppercase tracking-wide text-foreground-muted">
        {label}
      </span>
      <span className="mt-1 block text-[11px] font-medium text-foreground">{children}</span>
    </div>
  )
}
