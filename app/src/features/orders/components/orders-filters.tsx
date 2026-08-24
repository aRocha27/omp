import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import type { OrderSearchFilters } from '@/domain/models/order'
import { areas, instrumentos, orderTypes, produtos, tipos } from '@/fixtures/reference-data'
import type { ReferenceOption } from '@/fixtures/reference-data'

export interface OrdersFiltersValue {
  clientName: string
  /** "Only factory orders" toggle — `false` = no filter. */
  orderFactory: boolean
  /** Order type codes (multi-select). */
  idTpOrder: string[]
  /** Business area codes (multi-select). */
  idArea: string[]
  /** Order kind codes (multi-select). */
  idTipo: string[]
  /** Product ids (multi-select). */
  idProduto: number[]
  /** Instrument ids (multi-select). */
  idInstrumento: number[]
  /** PHC order ref (`Encomenda_Cli_PHC`): '' = no filter. */
  encomendaCliPHC: string
  /** "Only closed deals" toggle — `false` = no filter. */
  negocioFechado: boolean
  dateFrom: string
  dateTo: string
}

interface OrdersFiltersProps {
  value: OrdersFiltersValue
  onChange: (next: OrdersFiltersValue) => void
}

/** Cleared filter state for the in-bar Clear button (not exported — see orders-page for
 * the page-level initial state). */
const emptyFilters: OrdersFiltersValue = {
  clientName: '',
  orderFactory: false,
  idTpOrder: [],
  idArea: [],
  idTipo: [],
  idProduto: [],
  idInstrumento: [],
  encomendaCliPHC: '',
  negocioFechado: false,
  dateFrom: '',
  dateTo: '',
}

/**
 * Filter bar for the orders list.
 *
 * Each checkbox filter (order type / area / tipo / product / instrument + the two "only
 * show…" booleans) is a button that opens a dropdown panel of checkbox(es) — multi-select
 * for the categoricals, a single toggle for the booleans. The button shows a count badge
 * and highlights when the filter is active. Client / PHC ref stay contains-match text
 * inputs and the date range stays a pair of date inputs. `toSearchFilters` maps this state
 * into the nullable `OrderSearchFilters` the repository expects (arrays, with empty → null).
 *
 * Reference-data fixtures are the BRKR_ERP-verified pairs harvested 2026-08-23.
 */
export function OrdersFilters({ value, onChange }: OrdersFiltersProps) {
  const set = <K extends keyof OrdersFiltersValue>(key: K, next: OrdersFiltersValue[K]) =>
    onChange({ ...value, [key]: next })

  const toggleString = (key: 'idTpOrder' | 'idArea' | 'idTipo', code: string) => {
    const current = value[key]
    set(key, current.includes(code) ? current.filter((c) => c !== code) : [...current, code])
  }
  const toggleNumber = (key: 'idProduto' | 'idInstrumento', id: number) => {
    const current = value[key]
    set(key, current.includes(id) ? current.filter((c) => c !== id) : [...current, id])
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LabeledField label="Client">
          {(id) => (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground/40" aria-hidden />
              <Input
                id={id}
                className="pl-8"
                placeholder="Search client"
                value={value.clientName}
                onChange={(e) => set('clientName', e.target.value)}
              />
            </div>
          )}
        </LabeledField>

        <LabeledField label="PHC ref">
          {(id) => (
            <Input
              id={id}
              placeholder="Search PHC ref"
              value={value.encomendaCliPHC}
              onChange={(e) => set('encomendaCliPHC', e.target.value)}
            />
          )}
        </LabeledField>

        <LabeledField label="From date">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={value.dateFrom}
              onChange={(e) => set('dateFrom', e.target.value)}
            />
          )}
        </LabeledField>

        <LabeledField label="To date">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={value.dateTo}
              onChange={(e) => set('dateTo', e.target.value)}
            />
          )}
        </LabeledField>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdownButton label="Order type" selectedCount={value.idTpOrder.length}>
          <CheckboxList
            options={orderTypes}
            selected={value.idTpOrder}
            onToggle={(code) => toggleString('idTpOrder', String(code))}
          />
        </FilterDropdownButton>
        <FilterDropdownButton label="Area" selectedCount={value.idArea.length}>
          <CheckboxList
            options={areas}
            selected={value.idArea}
            onToggle={(code) => toggleString('idArea', String(code))}
          />
        </FilterDropdownButton>
        <FilterDropdownButton label="Tipo" selectedCount={value.idTipo.length}>
          <CheckboxList
            options={tipos}
            selected={value.idTipo}
            onToggle={(code) => toggleString('idTipo', String(code))}
          />
        </FilterDropdownButton>
        <FilterDropdownButton label="Product" selectedCount={value.idProduto.length}>
          <CheckboxList
            options={produtos}
            selected={value.idProduto}
            onToggle={(id) => toggleNumber('idProduto', Number(id))}
          />
        </FilterDropdownButton>
        <FilterDropdownButton label="Instrument" selectedCount={value.idInstrumento.length}>
          <CheckboxList
            options={instrumentos}
            selected={value.idInstrumento}
            onToggle={(id) => toggleNumber('idInstrumento', Number(id))}
            scrollable
          />
        </FilterDropdownButton>

        <FilterDropdownButton label="Factory order" selectedCount={value.orderFactory ? 1 : 0}>
          <BooleanCheckbox
            label="Only factory orders"
            checked={value.orderFactory}
            onChange={(next) => set('orderFactory', next)}
          />
        </FilterDropdownButton>
        <FilterDropdownButton label="Deal closed" selectedCount={value.negocioFechado ? 1 : 0}>
          <BooleanCheckbox
            label="Only closed deals"
            checked={value.negocioFechado}
            onChange={(next) => set('negocioFechado', next)}
          />
        </FilterDropdownButton>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(emptyFilters)}
          className="text-foreground/60"
        >
          <X className="size-4" aria-hidden />
          Clear
        </Button>
      </div>
    </div>
  )
}

/**
 * A button that opens a dropdown panel containing a filter's checkbox(es). Clicking the
 * button toggles the panel; the panel stays open while the user picks multiple items, and
 * closes on outside-pointer-down or Escape. The button highlights (primary tone) and shows
 * a count badge when the filter has a selection so active filters are visible at a glance.
 *
 * Accessibility: the button carries `aria-haspopup`/`aria-expanded`/`aria-controls`; the
 * panel is a `role="group"` labelled by the button, so screen readers announce the group
 * name and each checkbox (via its wrapping `<label>`).
 */
function FilterDropdownButton({
  label,
  selectedCount,
  children,
}: {
  label: string
  selectedCount: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonId = useId()
  const panelId = useId()
  const active = selectedCount > 0

  // Close on outside pointer-down and on Escape. Listeners attach only while open.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={buttonId}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          active
            ? 'border-primary/60 bg-primary/10 text-primary'
            : 'border-border bg-surface text-foreground hover:bg-foreground/5',
        )}
      >
        <span>{label}</span>
        {active && (
          <span
            aria-hidden
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white"
          >
            {selectedCount}
          </span>
        )}
        <ChevronDown
          className={cn('size-3.5 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-labelledby={buttonId}
          className="absolute left-0 z-20 mt-1 min-w-52 rounded-md border border-border bg-surface p-2 shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * Multi-select checkbox list for a categorical filter. Each option's checkbox is labelled
 * (via a wrapping `<label>`) with the option's display text, so screen readers announce
 * "BDAL, checkbox" etc. Long lists (instrumentos) render in a scroll panel so the dropdown
 * doesn't overflow the viewport.
 */
function CheckboxList({
  options,
  selected,
  onToggle,
  scrollable = false,
}: {
  options: readonly ReferenceOption[]
  selected: readonly (string | number)[]
  onToggle: (id: string | number) => void
  scrollable?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-1', scrollable && 'max-h-56 overflow-y-auto pr-1')}>
      {options.map((option) => {
        const id = option.id
        const isChecked = selected.includes(id)
        return (
          <label
            key={String(id)}
            className="flex items-center gap-2 text-sm text-foreground hover:bg-foreground/5 rounded px-1 py-0.5"
          >
            <Checkbox
              checked={isChecked}
              onChange={() => onToggle(id)}
              aria-label={option.label}
            />
            <span className="truncate">{option.label}</span>
          </label>
        )
      })}
    </div>
  )
}

/** Single "only show…" checkbox used inside a boolean filter's dropdown. */
function BooleanCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 whitespace-nowrap text-sm text-foreground hover:bg-foreground/5 rounded px-1 py-0.5">
      <Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span>{label}</span>
    </label>
  )
}

/**
 * Renders a field label associated (via `htmlFor`) with the control returned
 * by `children`. The control receives the generated `id` so screen readers
 * announce the label for the actual input, not a wrapper div.
 */
function LabeledField({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-wider text-foreground/50">
        {label}
      </label>
      {children(id)}
    </div>
  )
}

/** Maps the bar's state into the repository's nullable filters. Empty arrays and `false`
 * booleans become null (no filter); non-empty arrays pass through; checked booleans pass
 * `true`. */
export function toSearchFilters(value: OrdersFiltersValue): OrderSearchFilters {
  return {
    clientName: value.clientName.trim() || null,
    orderFactory: value.orderFactory ? true : null,
    idTpOrder: value.idTpOrder.length > 0 ? value.idTpOrder : null,
    idArea: value.idArea.length > 0 ? value.idArea : null,
    idTipo: value.idTipo.length > 0 ? value.idTipo : null,
    idProduto: value.idProduto.length > 0 ? value.idProduto : null,
    idInstrumento: value.idInstrumento.length > 0 ? value.idInstrumento : null,
    encomendaCliPHC: value.encomendaCliPHC.trim() || null,
    negocioFechado: value.negocioFechado ? true : null,
    dateFrom: value.dateFrom || null,
    dateTo: value.dateTo || null,
  }
}