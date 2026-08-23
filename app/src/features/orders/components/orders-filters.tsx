import { useId } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { OrderSearchFilters } from '@/domain/models/order'

export interface OrdersFiltersValue {
  clientName: string
  /** Factory-order flag (`Order_Factory`): '' = no filter. */
  orderFactory: '' | 'true' | 'false'
  idTpOrder: string
  negocioFechado: '' | 'true' | 'false'
  dateFrom: string
  dateTo: string
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
 */
export function OrdersFilters({ value, onChange }: OrdersFiltersProps) {
  const set = <K extends keyof OrdersFiltersValue>(key: K, next: OrdersFiltersValue[K]) =>
    onChange({ ...value, [key]: next })

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <LabeledField label="Client">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground/40" aria-hidden />
          <Input
            className="pl-8"
            placeholder="Search client"
            value={value.clientName}
            onChange={(e) => set('clientName', e.target.value)}
          />
        </div>
      </LabeledField>

      <LabeledField label="Factory order">
        <Select
          value={value.orderFactory}
          onChange={(e) => set('orderFactory', e.target.value as OrdersFiltersValue['orderFactory'])}
        >
          <option value="">All</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
      </LabeledField>

      <LabeledField label="Order type">
        <Input
          placeholder="Type code"
          value={value.idTpOrder}
          onChange={(e) => set('idTpOrder', e.target.value)}
        />
      </LabeledField>

      <LabeledField label="Deal closed">
        <Select
          value={value.negocioFechado}
          onChange={(e) => set('negocioFechado', e.target.value as OrdersFiltersValue['negocioFechado'])}
        >
          <option value="">All</option>
          <option value="true">Closed</option>
          <option value="false">Open</option>
        </Select>
      </LabeledField>

      <LabeledField label="From date">
        <Input
          type="date"
          value={value.dateFrom}
          onChange={(e) => set('dateFrom', e.target.value)}
        />
      </LabeledField>

      <LabeledField label="To date">
        <Input
          type="date"
          value={value.dateTo}
          onChange={(e) => set('dateTo', e.target.value)}
        />
      </LabeledField>

      <div className="flex items-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              clientName: '',
              orderFactory: '',
              idTpOrder: '',
              negocioFechado: '',
              dateFrom: '',
              dateTo: '',
            })
          }
          className="text-foreground/60"
        >
          <X className="size-4" aria-hidden />
          Clear
        </Button>
      </div>
    </div>
  )
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-wider text-foreground/50">
        {label}
      </label>
      <div id={id}>{children}</div>
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
    negocioFechado:
      value.negocioFechado === '' ? null : value.negocioFechado === 'true',
    dateFrom: value.dateFrom || null,
    dateTo: value.dateTo || null,
  }
}