import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, CircleAlert, Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingBlock } from '@/components/ui/spinner'
import { useCurrentUser } from '@/app/providers/user-provider'
import { canEdit } from '@/domain/permissions'
import { useOrders } from '@/features/orders/api/use-orders'
import {
  OrdersFilters,
  toSearchFilters,
  type OrdersFiltersValue,
} from '@/features/orders/components/orders-filters'
import { OrdersTable } from '@/features/orders/components/orders-table'
import { OrdersExportButton } from '@/features/orders/components/orders-export-button'
import {
  areaLabel,
  instrumentoLabel,
  orderTypeLabel,
  produtoLabel,
  tipoLabel,
} from '@/features/orders/components/reference-labels'
import type { ExportFilterLabels } from '@/utils/orders-export'

/** Initial/cleared filter state: every categorical empty, both toggles off, text empty. */
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
 * localStorage key for the persisted Orders list filters. Survives a detail visit and
 * back (the list page remounts) and a reload, so the user's filter context is not lost.
 * Per-viewer only — each browser/Private window has its own store; nothing reaches the
 * server or other viewers.
 */
const FILTERS_STORAGE_KEY = 'orderspaisoft.orders-filters.v1'

function loadFilters(): OrdersFiltersValue {
  try {
    const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY)
    if (!raw) return emptyFilters
    const parsed = JSON.parse(raw) as Partial<OrdersFiltersValue>
    // Merge over the empty base so a stored partial (or a schema change) never drops a
    // required field — every key defaults back to its "no filter" value.
    return { ...emptyFilters, ...parsed }
  } catch {
    // Private mode / disabled storage / corrupt JSON — fall back to no filters.
    return emptyFilters
  }
}

/** A filter value is "active" if it's a non-empty string, a non-empty array, or `true`.
 * Empty strings, empty arrays, and `false` mean "no filter". */
function isFilterActive(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'boolean') return value
  return value !== ''
}

export function OrdersPage() {
  const navigate = useNavigate()
  const user = useCurrentUser()
  // Lazy initialiser reads persisted filters once on mount so a detail visit and back
  // restores the exact filter set the user left behind.
  const [filters, setFilters] = useState<OrdersFiltersValue>(loadFilters)

  // Persist on every change. The react-query list key includes the normalised filters,
  // so the matching query is reused on remount — no refetch flash.
  useEffect(() => {
    try {
      window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
    } catch {
      // Ignore quota / private-mode failures — persistence is a convenience, not a contract.
    }
  }, [filters])

  const searchFilters = useMemo(() => toSearchFilters(filters), [filters])
  const { data, isPending, isError, error } = useOrders(searchFilters)

  const showCreate = canEdit(user)
  const orders = data ?? []
  const hasActiveFilters = Object.values(filters).some(isFilterActive)

  // File-name slugs use the human-readable label of the FIRST selected option in
  // each categorical filter (the same parent the cascade dropdowns narrow by),
  // joined to a single slug. Slug format is the responsibility of buildOrdersFileName.
  const exportLabels = useMemo<ExportFilterLabels>(
    () => ({
      clientName: filters.clientName.trim() || null,
      orderType: filters.idTpOrder[0] ? (orderTypeLabel(filters.idTpOrder[0]) ?? null) : null,
      area: filters.idArea[0] ? (areaLabel(filters.idArea[0]) ?? null) : null,
      tipo: filters.idTipo[0] ? (tipoLabel(filters.idTipo[0]) ?? null) : null,
      product: filters.idProduto[0]
        ? (produtoLabel(filters.idProduto[0]) ?? null)
        : null,
      instrument: filters.idInstrumento[0]
        ? (instrumentoLabel(filters.idInstrumento[0]) ?? null)
        : null,
      sapOrder: filters.encomendaCliPHC.trim() || null,
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null,
      factoryOnly: filters.orderFactory,
      closedOnly: filters.negocioFechado,
    }),
    [filters],
  )

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="shrink-0">
        <PageHeader
          title="Orders"
          description="All orders, newest first."
          actions={
            <div className="flex items-center gap-2">
              <OrdersExportButton orders={orders} filterLabels={exportLabels} />
              {showCreate && (
                <Button size="sm" onClick={() => navigate('/orders/new')}>
                  <Plus className="size-4" aria-hidden />
                  New order
                </Button>
              )}
            </div>
          }
        />
      </div>

      <div className="shrink-0">
        <OrdersFilters value={filters} onChange={setFilters} />
      </div>

      <div className="flex-1 min-h-0">
        {isPending ? (
          <LoadingBlock label="Loading orders…" />
        ) : isError ? (
          <EmptyState
            icon={CircleAlert}
            title="Couldn’t load orders"
            description={error instanceof Error ? error.message : 'Something went wrong.'}
          />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={hasActiveFilters ? 'No orders match these filters' : 'No orders yet'}
            description={
              hasActiveFilters
                ? 'Try clearing some filters to see more results.'
                : 'Orders will appear here once they are created.'
            }
            action={
              hasActiveFilters ? (
                <Button size="sm" variant="secondary" onClick={() => setFilters(emptyFilters)}>
                  Clear filters
                </Button>
              ) : showCreate ? (
                <Button size="sm" onClick={() => navigate('/orders/new')}>
                  <Plus className="size-4" aria-hidden />
                  New order
                </Button>
              ) : undefined
            }
          />
        ) : (
          <OrdersTable data={orders} onRowClick={(id) => navigate(`/orders/${id}`)} />
        )}
      </div>
    </div>
  )
}