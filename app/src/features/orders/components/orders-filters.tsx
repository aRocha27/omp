import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { cn } from '@/components/ui/cn'
import type { OrderSearchFilters } from '@/domain/models/order'
import {
  areas,
  instrumentos,
  orderTypes,
  produtos,
  tipos,
  type InstrumentoOption,
  type ProdutoOption,
  type ReferenceOption,
} from '@/fixtures/reference-data'
import { useProdutos } from '@/features/orders/api/use-produtos'
import { useInstrumentos } from '@/features/orders/api/use-instrumentos'

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

/** Merge a parent-filtered option list with the currently-held child value.
 *
 * The cascade dropdowns show only the parent's children, but a held id that no longer
 * matches its parent (data drift) must stay visible so the user can keep or remove it
 * without losing the row from the table. The held id is prepended from the full
 * fixture list when it isn't already in the filtered set; new picks stay constrained
 * to the filtered children. This is the same contract the create/detail forms use. */
function mergeSaved<T extends ReferenceOption>(
  filtered: readonly T[] | undefined,
  heldIds: readonly (string | number)[],
  full: readonly T[],
): T[] {
  const list: T[] = filtered ? [...filtered] : []
  for (const heldId of heldIds) {
    if (heldId == null || heldId === '') continue
    if (list.some((o) => String(o.id) === String(heldId))) continue
    const held = full.find((o) => String(o.id) === String(heldId))
    if (held) list.unshift(held)
  }
  return list
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
 * and highlights when the filter is active. Client / SAP ref stay contains-match text
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

  // Cascade: Area → Product → Instrument (mirrors the create-order form).
  // The list filter still accepts multiple selected areas / products, but the cascade
  // can only narrow by a single parent. We pick the first selected area as the Product
  // parent and the first selected product as the Instrument parent — the rest of the
  // selected ids still filter the table; the dropdown just shows one branch. This is
  // the same contract the create form uses: a single Área/Produto cascades to children,
  // and the held child id is merged back in (mergeSaved) so it stays visible/selectable
  // even when the parent narrows the list.
  const cascadeArea = value.idArea[0]
  const cascadeProduto = value.idProduto[0]

  const produtosQuery = useProdutos({ area: cascadeArea, enabled: cascadeArea != null })
  const instrumentosQuery = useInstrumentos({
    produto: cascadeProduto,
    enabled: cascadeProduto != null,
  })

  const produtoOptions = useMemo<ProdutoOption[]>(() => {
    // No area selected → the Product dropdown is unconstrained, so it always
    // shows the full fixture. Once an area is selected, the cascade narrows
    // to that area's products; while the live query is still in flight we
    // show nothing rather than the full list (which would be misleading).
    const list = cascadeArea
      ? (produtosQuery.data ?? [])
      : (produtos as ProdutoOption[])
    return mergeSaved(list, value.idProduto, produtos as ProdutoOption[])
  }, [cascadeArea, produtosQuery.data, value.idProduto])
  const instrumentoOptions = useMemo<InstrumentoOption[]>(() => {
    const list = cascadeProduto
      ? (instrumentosQuery.data ?? [])
      : (instrumentos as InstrumentoOption[])
    return mergeSaved(list, value.idInstrumento, instrumentos as InstrumentoOption[])
  }, [cascadeProduto, instrumentosQuery.data, value.idInstrumento])

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

        <LabeledField label="SAP Order">
          {(id) => (
            <Input
              id={id}
              placeholder="Search SAP Order"
              value={value.encomendaCliPHC}
              onChange={(e) => set('encomendaCliPHC', e.target.value)}
            />
          )}
        </LabeledField>

        <LabeledField label="From date">
          {(id) => (
            <DatePicker
              id={id}
              aria-label="From date"
              value={value.dateFrom || null}
              onChange={(next) => set('dateFrom', next ?? '')}
            />
          )}
        </LabeledField>

        <LabeledField label="To date">
          {(id) => (
            <DatePicker
              id={id}
              aria-label="To date"
              value={value.dateTo || null}
              onChange={(next) => set('dateTo', next ?? '')}
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
        <FilterDropdownButton label="Type" selectedCount={value.idTipo.length}>
          <CheckboxList
            options={tipos}
            selected={value.idTipo}
            onToggle={(code) => toggleString('idTipo', String(code))}
          />
        </FilterDropdownButton>
        <FilterDropdownButton
          label={cascadeArea ? `Product (in ${cascadeArea})` : 'Product'}
          selectedCount={value.idProduto.length}
        >
          <CheckboxList
            options={produtoOptions}
            selected={value.idProduto}
            onToggle={(id) => toggleNumber('idProduto', Number(id))}
          />
        </FilterDropdownButton>
        <FilterDropdownButton
          label={cascadeProduto ? `Instrument (in product ${cascadeProduto})` : 'Instrument'}
          selectedCount={value.idInstrumento.length}
        >
          <CheckboxList
            options={instrumentoOptions}
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