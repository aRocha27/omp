import { useId, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { OrderSearchFilters } from '@/domain/models/order'
import { areas, instrumentos, orderTypes, produtos } from '@/fixtures/reference-data'

export interface OrdersFiltersValue {
  clientName: string
  /** Factory-order flag (`Order_Factory`): '' = no filter. */
  orderFactory: '' | 'true' | 'false'
  idTpOrder: string
  idArea: string
  idProduto: string
  idInstrumento: string
  /** PHC order ref (`Encomenda_Cli_PHC`): '' = no filter. */
  encomendaCliPHC: string
  negocioFechado: '' | 'true' | 'false'
  dateFrom: string
  dateTo: string
}

const emptyFiltersValue: OrdersFiltersValue = {
  clientName: '',
  orderFactory: '',
  idTpOrder: '',
  idArea: '',
  idProduto: '',
  idInstrumento: '',
  encomendaCliPHC: '',
  negocioFechado: '',
  dateFrom: '',
  dateTo: '',
}

interface OrdersFiltersProps {
  value: OrdersFiltersValue
  onChange: (next: OrdersFiltersValue) => void
}

/**
 * Filter bar for the orders list.
 *
 * UI values use empty-string sentinels for "no filter"; `toSearchFilters`
 * maps them into the nullable `OrderSearchFilters` the repository expects.
 * Categorical filters (type/area/product/instrument) are dropdowns populated
 * from synthetic reference-data fixtures (AGENT.md §9; the HTML MVP is a UI
 * reference only — option labels are unverified placeholders, not facts).
 */
export function OrdersFilters({ value, onChange }: OrdersFiltersProps) {
  const set = <K extends keyof OrdersFiltersValue>(key: K, next: OrdersFiltersValue[K]) =>
    onChange({ ...value, [key]: next })

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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

      <LabeledField label="Order type">
        {(id) => (
          <Select id={id} value={value.idTpOrder} onChange={(e) => set('idTpOrder', e.target.value)}>
            <option value="">All</option>
            {orderTypes.map((o) => (
              <option key={o.id} value={String(o.id)}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </LabeledField>

      <LabeledField label="Area">
        {(id) => (
          <Select id={id} value={value.idArea} onChange={(e) => set('idArea', e.target.value)}>
            <option value="">All</option>
            {areas.map((o) => (
              <option key={o.id} value={String(o.id)}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </LabeledField>

      <LabeledField label="Product">
        {(id) => (
          <Select id={id} value={value.idProduto} onChange={(e) => set('idProduto', e.target.value)}>
            <option value="">All</option>
            {produtos.map((o) => (
              <option key={o.id} value={String(o.id)}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
      </LabeledField>

      <LabeledField label="Instrument">
        {(id) => (
          <Select id={id} value={value.idInstrumento} onChange={(e) => set('idInstrumento', e.target.value)}>
            <option value="">All</option>
            {instrumentos.map((o) => (
              <option key={o.id} value={String(o.id)}>
                {o.label}
              </option>
            ))}
          </Select>
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

      <LabeledField label="Factory order">
        {(id) => (
          <Select
            id={id}
            value={value.orderFactory}
            onChange={(e) => set('orderFactory', e.target.value as OrdersFiltersValue['orderFactory'])}
          >
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        )}
      </LabeledField>

      <LabeledField label="Deal closed">
        {(id) => (
          <Select
            id={id}
            value={value.negocioFechado}
            onChange={(e) => set('negocioFechado', e.target.value as OrdersFiltersValue['negocioFechado'])}
          >
            <option value="">All</option>
            <option value="true">Closed</option>
            <option value="false">Open</option>
          </Select>
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

      <div className="flex items-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(emptyFiltersValue)}
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
 * Renders a field label associated (via `htmlFor`) with the control returned
 * by `children`. The control receives the generated `id` so screen readers
 * announce the label for the actual input/select, not a wrapper div.
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

/** Maps the bar's string-based state into the repository's nullable filters. */
export function toSearchFilters(value: OrdersFiltersValue): OrderSearchFilters {
  return {
    clientName: value.clientName.trim() || null,
    orderFactory:
      value.orderFactory === '' ? null : value.orderFactory === 'true',
    idTpOrder: value.idTpOrder.trim() || null,
    idArea: value.idArea === '' ? null : Number(value.idArea),
    idProduto: value.idProduto === '' ? null : Number(value.idProduto),
    idInstrumento: value.idInstrumento === '' ? null : Number(value.idInstrumento),
    encomendaCliPHC: value.encomendaCliPHC.trim() || null,
    negocioFechado:
      value.negocioFechado === '' ? null : value.negocioFechado === 'true',
    dateFrom: value.dateFrom || null,
    dateTo: value.dateTo || null,
  }
}