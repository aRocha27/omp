import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { cn } from '@/components/ui/cn'
import type { OrderFacetOption, OrderSearchFilters } from '@/domain/models/order'
import type { ReferenceOption } from '@/fixtures/reference-data'
import { useOrderFacets } from '@/features/orders/api/use-orders'
import { useRepositories } from '@/app/providers/repository-provider'
import { ActiveFilterChips } from '@/features/recognition/components/recognition-multi-select-filter'

/** A facet option as returned by the backend (`label` may be `null` when the
 * underlying master-data row has no display text). The CheckboxList renders
 * `null` labels as a muted `—` slot so the id-as-label fallback is never used. */
type FacetChoice = OrderFacetOption | ReferenceOption

/**
 * Canonical labels for active filter chips come from the most recent backend
 * facet response — never from the local reference-data fixtures. Master data
 * is dynamic: a new Area / Product / Instrument created via master-data
 * maintenance is unknown to the fixtures, and a removed / renamed row must
 * show a neutral placeholder instead of a stale label or the raw id.
 *
 * `facetLabel` looks up an id in the option map and returns `null` when the
 * id is not present (e.g. mid-loading) or when the backend returned a null
 * label. Callers use the fallback string (`—`) so the UI never renders an
 * internal identifier as a business label.
 */
function facetLabel(map: ReadonlyMap<string, string | null>, id: string | number): string | null {
  return map.get(String(id)) ?? null
}

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
  /** Invoice number (`Facturacao.N_Doc_FT`): '' = no filter. */
  invoiceNumber: string
  /** "Only closed deals" toggle — `false` = no filter. */
  negocioFechado: boolean
  dateFrom: string
  dateTo: string
}

interface OrdersFiltersProps {
  value: OrdersFiltersValue
  onChange: (next: OrdersFiltersValue) => void
  toolbar?: ReactNode
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
  invoiceNumber: '',
  negocioFechado: false,
  dateFrom: '',
  dateTo: '',
}

/**
 * Filter bar for the orders list.
 *
 * Each categorical filter (order type / area / tipo / product / instrument) is a
 * multi-select dropdown whose available options come from the backend facets
 * endpoint (`POST /api/orders/facets`). Every selected facet immediately narrows
 * the option set on every other dropdown (faceted filtering). The backend
 * reuses the same WHERE builder as the list query, with `excluded = <facet>`
 * so each dropdown can offer alternatives to its current selection.
 *
 * Selection pruning is intentionally idempotent and load-aware:
 * - A selection is kept while its id still appears in the corresponding facet.
 * - It is removed only when the backend (with the matching filters) returns a
 *   fresh facet that does not contain it.
 * - During a refetch the previous facets remain in React Query's cache so we
 *   never wipe a selection because of a transient empty/undefined response.
 *
 * Master hierarchy `Area -> Product -> Instrument` is enforced through two
 * reference-data maps) — when an Area is dropped, the Products that don't
 * belong to any remaining Area are cleared; same for Product -> Instrument.
 * These structural checks run only over the current selection and never
 * over the table of Orders (which would couple facets to the displayed rows).
 *
 * All master data — Areas, Tipos, Produtos, Instrumentos, Order Types — is
 * data-driven: it comes from the live backend. The filter dropdowns and chip
 * labels resolve exclusively from the facet response (which joins the same
 * canonical view the list query reads); no fixture is consulted for the
 * list-of-options or label-of-id lookup at render time. New values created
 * through master-data maintenance become visible on the next facets fetch
 * because `MasterDataMaintenance` invalidates `['orders','facets']`,
 * `['orders','list']` and `['reference',*]` together (see
 * `MasterDataMaintenance.invalidateOrderQueries`).
 */
export function OrdersFilters({ value, onChange, toolbar }: OrdersFiltersProps) {
  const { reference } = useRepositories()
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

  const searchFilters = useMemo(() => toSearchFilters(value), [value])
  const facetsQuery = useOrderFacets(searchFilters)
  const facets = facetsQuery.data
  // `isFetching` covers both the initial load and a refetch triggered by a
  // filter change. The dropdown shows a "Loading options…" placeholder when
  // `facets` is empty + `isFetching` so the panel is never blank for long
  // enough to confuse the user (or the test runner).
  const facetsLoading = facetsQuery.isFetching

  // Reference hierarchy maps for the structural Area -> Product -> Instrument
  // pruning. We fetch every Area/Produto/Instrumento once and cache them; the
  // faceted query already filters the dropdown options to the active universe,
  // but the hierarchy checks run over the current selection so we don't depend
  // on the table of Orders to know which Instrumento "belongs to" which Produto.
  //
  // Areas are also used to resolve the parent label in the dropdown caption
  // ("Product (in <area>)") — the facet response key changes on every filter
  // change, but `['reference','areas']` is cached under a stable key so the
  // caption survives a refetch without flickering to a generic placeholder.
  const areasRefQuery = useQuery({
    queryKey: ['reference', 'areas'],
    queryFn: () => reference.listAreas(),
  })
  const produtosRefQuery = useQuery({
    queryKey: ['reference', 'produtos', 'all'],
    queryFn: () => reference.listProdutos(),
  })
  const instrumentosRefQuery = useQuery({
    queryKey: ['reference', 'instrumentos', 'all'],
    queryFn: () => reference.listInstrumentos(),
  })

  // id -> parent lookups. Computed once per reference-data fetch.
  const produtoAreaById = useMemo(() => {
    const map = new Map<number, string | null>()
    for (const produto of produtosRefQuery.data ?? []) {
      map.set(produto.id, produto.area)
    }
    return map
  }, [produtosRefQuery.data])
  const instrumentoProdutoById = useMemo(() => {
    const map = new Map<number, number | null>()
    for (const instrumento of instrumentosRefQuery.data ?? []) {
      map.set(instrumento.id, instrumento.produto)
    }
    return map
  }, [instrumentosRefQuery.data])
  // id -> label for the master Area catalog (stable key, survives facet
  // refetches). The Product / Instrument dropdown captions need a label for
  // their single parent selection; the facets response key changes with
  // every filter change and would otherwise flicker to "Product" between
  // selection and the next refetch.
  const areaLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const area of areasRefQuery.data ?? []) {
      if (area.label) map.set(String(area.id), area.label)
    }
    return map
  }, [areasRefQuery.data])
  const produtoLabelById = useMemo(() => {
    const map = new Map<number, string>()
    for (const produto of produtosRefQuery.data ?? []) {
      if (produto.label) map.set(produto.id, produto.label)
    }
    return map
  }, [produtosRefQuery.data])

  // Each dropdown shows options from the corresponding backend facet; the
  // returned options are already filtered to the active universe and
  // therefore authoritative for the faceted semantics (section 3).
  const orderTypeOptions = facets?.idTpOrder ?? []
  const areaOptions = facets?.idArea ?? []
  const tipoOptions = facets?.idTipo ?? []
  const produtoOptions = facets?.idProduto ?? []
  const instrumentoOptions = facets?.idInstrumento ?? []

  /**
   * Idempotent selection pruning driven by the most recent facet response.
   *
   * Two pruning passes run on every successful facets response:
   * 1. Universe pruning — drop any selected id that is no longer present in
   *    the corresponding facet option set.
   * 2. Structural pruning — enforce Area -> Product -> Instrument:
   *    - if Areas narrowed, drop Products whose parent Area is no longer
   *      selected;
   *    - if Products narrowed, drop Instruments whose parent Product is no
   *      longer selected.
   *
   * The pruning is `set`-based and runs only when the response corresponds to
   * the current filters (`facetsQuery.isSuccess`). React Query keys the
   * facets response by the normalised filters, so a stale response simply
   * belongs to a different key and never reaches `facetsQuery.data` while
   * the matching key is in flight.
   */
  useEffect(() => {
    if (!facets || !facetsQuery.isSuccess) return
    const validByKey = {
      idTpOrder: new Set(facets.idTpOrder.map((item) => item.id)),
      idArea: new Set(facets.idArea.map((item) => item.id)),
      idTipo: new Set(facets.idTipo.map((item) => item.id)),
      idProduto: new Set(facets.idProduto.map((item) => item.id)),
      idInstrumento: new Set(facets.idInstrumento.map((item) => item.id)),
    }
    const next: OrdersFiltersValue = { ...value }
    for (const key of Object.keys(validByKey) as Array<keyof typeof validByKey>) {
      next[key] = (value[key] as readonly (string | number)[]).filter((id) =>
        validByKey[key].has(id as never),
      ) as never
    }
    // Structural pruning. The hierarchy is `Area -> Product -> Instrument`,
    // so a child can only survive when at least one of its parents is also
    // still selected AND the parent maps to the child structurally. When a
    // parent filter is *empty* (the user never picked one) we do not wipe
    // existing children — they were either picked directly or inherited
    // from a previous narrower context, and the universe-pruning above has
    // already validated each id against the current facet set.
    if (next.idArea.length > 0) {
      const areas = new Set(next.idArea)
      next.idProduto = next.idProduto.filter((id) => {
        const area = produtoAreaById.get(id)
        return area === undefined || area === null || areas.has(area)
      })
    }
    if (next.idProduto.length > 0) {
      const produtos = new Set(next.idProduto)
      next.idInstrumento = next.idInstrumento.filter((id) => {
        const produto = instrumentoProdutoById.get(id)
        return produto === undefined || produto === null || produtos.has(produto)
      })
    }
    if (JSON.stringify(next) !== JSON.stringify(value)) onChange(next)
  }, [facets, facetsQuery.isSuccess, produtoAreaById, instrumentoProdutoById, onChange, value])

  /**
   * Active-filters summary, used for the dropdown button captions
   * (e.g. "Product (in BDAL)") and the chip fallback labels.
   *
   * The labels come from the facets first (canonical source) and fall back to
   * the reference-data fixtures — never to the raw id — so the UI never
   * displays an internal id as a label (section 10).
   */
  const labelsByKey = useMemo(() => {
    const mapOf = (items: readonly { id: string | number; label: string | null }[]) =>
      new Map(items.map((item) => [String(item.id), item.label ?? null]))
    return {
      idTpOrder: mapOf(orderTypeOptions),
      idArea: mapOf(areaOptions),
      idTipo: mapOf(tipoOptions),
      idProduto: mapOf(produtoOptions),
      idInstrumento: mapOf(instrumentoOptions),
    }
  }, [orderTypeOptions, areaOptions, tipoOptions, produtoOptions, instrumentoOptions])

  const productCaption = useMemo(() => {
    if (value.idArea.length !== 1) return 'Product'
    const id = value.idArea[0]
    // Prefer the canonical facet label; fall back to the stable master-data
    // catalog; finally fall back to the id code (the brief requires the id to
    // never be rendered as the visible label, so we drop the caption
    // entirely rather than show "Product (in BDAL)" with a code as label).
    const label = facetLabel(labelsByKey.idArea, id) ?? areaLabelById.get(id) ?? null
    return label ? `Product (in ${label})` : 'Product'
  }, [value.idArea, labelsByKey.idArea, areaLabelById])
  const instrumentCaption = useMemo(() => {
    if (value.idProduto.length !== 1) return 'Instrument'
    const id = value.idProduto[0]
    const label = facetLabel(labelsByKey.idProduto, id) ?? produtoLabelById.get(id) ?? null
    return label ? `Instrument (in product ${label})` : 'Instrument'
  }, [value.idProduto, labelsByKey.idProduto, produtoLabelById])

  return (
    <div className="relative mb-4 space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:shrink-0 lg:grid-cols-[260px_360px_180px_150px_150px]">
          <LabeledField label="Client">
            {(id) => (
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground/40"
                  aria-hidden
                />
                <Input
                  id={id}
                  className="w-[260px] max-w-full pl-8"
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
                className="w-[360px] max-w-full"
                placeholder="Search SAP Order"
                value={value.encomendaCliPHC}
                onChange={(e) => set('encomendaCliPHC', e.target.value)}
              />
            )}
          </LabeledField>

          <LabeledField label="Invoice Number">
            {(id) => (
              <Input
                id={id}
                className="w-[180px] max-w-full"
                placeholder="Search Invoice Number"
                value={value.invoiceNumber}
                onChange={(e) => set('invoiceNumber', e.target.value)}
              />
            )}
          </LabeledField>

          <LabeledField label="From date">
            {(id) => (
              <DatePicker
                id={id}
                aria-label="From date"
                className="w-[150px] max-w-full"
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
                className="w-[150px] max-w-full"
                value={value.dateTo || null}
                onChange={(next) => set('dateTo', next ?? '')}
              />
            )}
          </LabeledField>
        </div>
        {toolbar && <div className="flex min-w-0 flex-1 items-end gap-2">{toolbar}</div>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdownButton label="Order type" selectedCount={value.idTpOrder.length}>
          <CheckboxList
            options={orderTypeOptions}
            selected={value.idTpOrder}
            onToggle={(code) => toggleString('idTpOrder', String(code))}
            loading={facetsLoading && orderTypeOptions.length === 0}
          />
        </FilterDropdownButton>
        <FilterDropdownButton label="Area" selectedCount={value.idArea.length}>
          <CheckboxList
            options={areaOptions}
            selected={value.idArea}
            onToggle={(code) => toggleString('idArea', String(code))}
            loading={facetsLoading && areaOptions.length === 0}
          />
        </FilterDropdownButton>
        <FilterDropdownButton label="Type" selectedCount={value.idTipo.length}>
          <CheckboxList
            options={tipoOptions}
            selected={value.idTipo}
            onToggle={(code) => toggleString('idTipo', String(code))}
            loading={facetsLoading && tipoOptions.length === 0}
          />
        </FilterDropdownButton>
        <FilterDropdownButton label={productCaption} selectedCount={value.idProduto.length}>
          <CheckboxList
            options={produtoOptions}
            selected={value.idProduto}
            onToggle={(id) => toggleNumber('idProduto', Number(id))}
            loading={facetsLoading && produtoOptions.length === 0}
          />
        </FilterDropdownButton>
        <FilterDropdownButton label={instrumentCaption} selectedCount={value.idInstrumento.length}>
          <CheckboxList
            options={instrumentoOptions}
            selected={value.idInstrumento}
            onToggle={(id) => toggleNumber('idInstrumento', Number(id))}
            scrollable
            loading={facetsLoading && instrumentoOptions.length === 0}
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
          Clear filters
        </Button>
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        <ActiveFilterChips
          label="Client"
          selected={value.clientName ? [value.clientName] : []}
          onRemove={() => set('clientName', '')}
        />
        <ActiveFilterChips
          label="SAP Order"
          selected={value.encomendaCliPHC ? [value.encomendaCliPHC] : []}
          onRemove={() => set('encomendaCliPHC', '')}
        />
        <ActiveFilterChips
          label="Invoice Number"
          selected={value.invoiceNumber ? [value.invoiceNumber] : []}
          onRemove={() => set('invoiceNumber', '')}
        />
        <ActiveFilterChips
          label="From date"
          selected={value.dateFrom ? [value.dateFrom] : []}
          onRemove={() => set('dateFrom', '')}
        />
        <ActiveFilterChips
          label="To date"
          selected={value.dateTo ? [value.dateTo] : []}
          onRemove={() => set('dateTo', '')}
        />
        <ActiveFilterChips
          label="Order type"
          selected={value.idTpOrder}
          onRemove={(item) =>
            set(
              'idTpOrder',
              value.idTpOrder.filter((entry) => entry !== item),
            )
          }
          formatOption={(item) => facetLabel(labelsByKey.idTpOrder, item) ?? '—'}
          onClear={() => set('idTpOrder', [])}
        />
        <ActiveFilterChips
          label="Area"
          selected={value.idArea}
          onRemove={(item) =>
            set(
              'idArea',
              value.idArea.filter((entry) => entry !== item),
            )
          }
          formatOption={(item) => facetLabel(labelsByKey.idArea, item) ?? '—'}
          onClear={() => set('idArea', [])}
        />
        <ActiveFilterChips
          label="Type"
          selected={value.idTipo}
          onRemove={(item) =>
            set(
              'idTipo',
              value.idTipo.filter((entry) => entry !== item),
            )
          }
          formatOption={(item) => facetLabel(labelsByKey.idTipo, item) ?? '—'}
          onClear={() => set('idTipo', [])}
        />
        <ActiveFilterChips
          label="Product"
          selected={value.idProduto}
          onRemove={(item) =>
            set(
              'idProduto',
              value.idProduto.filter((entry) => entry !== item),
            )
          }
          formatOption={(item) => facetLabel(labelsByKey.idProduto, item) ?? '—'}
          onClear={() => set('idProduto', [])}
        />
        <ActiveFilterChips
          label="Instrument"
          selected={value.idInstrumento}
          onRemove={(item) =>
            set(
              'idInstrumento',
              value.idInstrumento.filter((entry) => entry !== item),
            )
          }
          formatOption={(item) => facetLabel(labelsByKey.idInstrumento, item) ?? '—'}
          onClear={() => set('idInstrumento', [])}
        />
        <ActiveFilterChips
          label="Factory"
          selected={value.orderFactory ? ['Only factory orders'] : []}
          onRemove={() => set('orderFactory', false)}
        />
        <ActiveFilterChips
          label="Deal closed"
          selected={value.negocioFechado ? ['Only closed deals'] : []}
          onRemove={() => set('negocioFechado', false)}
        />
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
          'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-sm font-medium transition-colors',
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
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
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
          className="absolute left-0 z-20 mt-1 max-w-[calc(100vw-1.5rem)] min-w-52 rounded-md border border-border bg-surface p-2 shadow-lg"
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
 *
 * `options` carries `{ id, label }`. When `label` is `null` the option is rendered as a
 * disabled muted slot so the underlying id is never shown as a business label (section 10).
 */
function CheckboxList({
  options,
  selected,
  onToggle,
  scrollable = false,
  loading = false,
}: {
  options: readonly FacetChoice[]
  selected: readonly (string | number)[]
  onToggle: (id: string | number) => void
  scrollable?: boolean
  /**
   * `true` while the facet query for this dimension is in flight. Renders a
   * muted placeholder so the panel isn't empty during the initial fetch or a
   * refetch triggered by a filter change (this also keeps testing-library
   * waits bounded — the placeholder is stable until the real options arrive).
   */
  loading?: boolean
}) {
  if (loading && options.length === 0) {
    return (
      <div className={cn('flex flex-col gap-1', scrollable && 'max-h-56 overflow-y-auto pr-1')}>
        <span className="px-1 py-1 text-xs text-foreground/50" role="status">
          Loading options…
        </span>
      </div>
    )
  }
  return (
    <div className={cn('flex flex-col gap-1', scrollable && 'max-h-56 overflow-y-auto pr-1')}>
      {options.map((option) => {
        const id = option.id
        const isChecked = selected.includes(id)
        if (option.label === null) {
          return (
            <span
              key={String(id)}
              className="flex items-center gap-2 text-sm text-foreground/40 rounded px-1 py-0.5"
              aria-disabled
            >
              <Checkbox checked={false} disabled aria-label="(no label)" />
              <span className="truncate">—</span>
            </span>
          )
        }
        return (
          <label
            key={String(id)}
            className="flex items-center gap-2 text-sm text-foreground hover:bg-foreground/5 rounded px-1 py-0.5"
          >
            <Checkbox checked={isChecked} onChange={() => onToggle(id)} aria-label={option.label} />
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
      <label
        htmlFor={id}
        className="text-[11px] font-medium uppercase tracking-wider text-foreground/50"
      >
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
    invoiceNumber: value.invoiceNumber.trim() || null,
    negocioFechado: value.negocioFechado ? true : null,
    dateFrom: value.dateFrom || null,
    dateTo: value.dateTo || null,
  }
}
