import { useEffect, useMemo, useState } from 'react'
import type { SortingState } from '@tanstack/react-table'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, CircleAlert, Mail, Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingBlock } from '@/components/ui/spinner'
import { useCurrentUser } from '@/app/providers/user-provider'
import type { OrderSortId } from '@/domain/models/order'
import { useRepositories } from '@/app/providers/repository-provider'
import { canEdit } from '@/domain/permissions'
import { useOrders, useOrderFacets } from '@/features/orders/api/use-orders'
import {
  OrdersFilters,
  toSearchFilters,
  type OrdersFiltersValue,
} from '@/features/orders/components/orders-filters'
import { OrdersTable } from '@/features/orders/components/orders-table'
import { OrdersExportButton } from '@/features/orders/components/orders-export-button'
import type { ExportFilterLabels } from '@/utils/orders-export'
import { SendDocumentsModal } from '@/features/orders/components/send-documents-modal'

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
  invoiceNumber: '',
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
const FILTERS_STORAGE_KEY = 'omp.orders-filters.v1'

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
  const { orders: ordersRepository } = useRepositories()
  // Lazy initialiser reads persisted filters once on mount so a detail visit and back
  // restores the exact filter set the user left behind.
  const [filters, setFilters] = useState<OrdersFiltersValue>(loadFilters)
  const [appliedFilters, setAppliedFilters] = useState<OrdersFiltersValue>(filters)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'DT_Order', desc: true }])
  const [sendDocumentsOpen, setSendDocumentsOpen] = useState(false)

  // Persist on every change. The react-query list key includes the normalised filters,
  // so the matching query is reused on remount — no refetch flash.
  useEffect(() => {
    try {
      window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
    } catch {
      // Ignore quota / private-mode failures — persistence is a convenience, not a contract.
    }
  }, [filters])

  useEffect(() => {
    const timeout = window.setTimeout(() => setAppliedFilters(filters), 300)
    return () => window.clearTimeout(timeout)
  }, [filters])

  const searchFilters = useMemo(() => toSearchFilters(appliedFilters), [appliedFilters])
  const { data, isPending, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage, total } =
    useOrders(searchFilters, {
      id: (sorting[0]?.id ?? 'DT_Order') as OrderSortId,
      desc: sorting[0]?.desc ?? true,
    })
  const facetsQuery = useOrderFacets(searchFilters)

  const showCreate = canEdit(user)
  const orders = data ?? []
  const hasActiveFilters = Object.values(filters).some(isFilterActive)

  // Build an id -> label map from the canonical facet response so the export
  // filename slugs always reflect the live database labels — never the
  // hardcoded fixtures. A id selected but missing from the current facets is
  // not exported as a label (we already pruned those out in the filters, but
  // this guards the brief window between a new selection and the next refetch).
  const facetLabelMaps = useMemo(() => {
    const mapOf = (items: readonly { id: string | number; label: string | null }[] | undefined) =>
      new Map((items ?? []).map((item) => [String(item.id), item.label ?? null]))
    return {
      idTpOrder: mapOf(facetsQuery.data?.idTpOrder),
      idArea: mapOf(facetsQuery.data?.idArea),
      idTipo: mapOf(facetsQuery.data?.idTipo),
      idProduto: mapOf(facetsQuery.data?.idProduto),
      idInstrumento: mapOf(facetsQuery.data?.idInstrumento),
    }
  }, [facetsQuery.data])

  // File-name slugs use the human-readable label of the FIRST selected option
  // in each categorical filter, joined to a single slug. Slug format is the
  // responsibility of buildOrdersFileName.
  const exportLabels = useMemo<ExportFilterLabels>(
    () => ({
      clientName: appliedFilters.clientName.trim() || null,
      orderType: appliedFilters.idTpOrder[0]
        ? (facetLabelMaps.idTpOrder.get(String(appliedFilters.idTpOrder[0])) ?? null)
        : null,
      area: appliedFilters.idArea[0]
        ? (facetLabelMaps.idArea.get(String(appliedFilters.idArea[0])) ?? null)
        : null,
      tipo: appliedFilters.idTipo[0]
        ? (facetLabelMaps.idTipo.get(String(appliedFilters.idTipo[0])) ?? null)
        : null,
      product: appliedFilters.idProduto[0]
        ? (facetLabelMaps.idProduto.get(String(appliedFilters.idProduto[0])) ?? null)
        : null,
      instrument: appliedFilters.idInstrumento[0]
        ? (facetLabelMaps.idInstrumento.get(String(appliedFilters.idInstrumento[0])) ?? null)
        : null,
      sapOrder: appliedFilters.encomendaCliPHC.trim() || null,
      dateFrom: appliedFilters.dateFrom || null,
      dateTo: appliedFilters.dateTo || null,
      factoryOnly: appliedFilters.orderFactory,
      closedOnly: appliedFilters.negocioFechado,
    }),
    [appliedFilters, facetLabelMaps],
  )

  async function loadAllOrdersForExport() {
    const pageSize = 500
    const allOrders = []
    let offset = 0

    while (true) {
      const page = await ordersRepository.searchPage(searchFilters, {
        limit: pageSize,
        offset,
        sort: {
          id: (sorting[0]?.id ?? 'DT_Order') as OrderSortId,
          direction: sorting[0]?.desc === false ? 'asc' : 'desc',
        },
      })
      allOrders.push(...page.items)
      if (!page.nextCursor) return allOrders
      offset += page.items.length
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 max-md:min-w-0">
      <div className="shrink-0">
        <PageHeader title="Orders" description="All orders, newest first." />
      </div>
      {sendDocumentsOpen && <SendDocumentsModal onClose={() => setSendDocumentsOpen(false)} />}

      <div className="shrink-0">
        <OrdersFilters
          value={filters}
          onChange={setFilters}
          toolbar={
            <>
              <OrdersExportButton
                orders={orders}
                filterLabels={exportLabels}
                loadAllOrders={loadAllOrdersForExport}
                className="h-12 flex-1 px-4"
              />
              <Button
                size="md"
                variant="secondary"
                className="h-12 flex-1 px-4"
                onClick={() => setSendDocumentsOpen(true)}
                aria-label="Send Invoices"
                title="Send Invoices"
              >
                <Mail className="size-5" aria-hidden />
                Send Invoices
              </Button>
              {showCreate && (
                <div className="flex flex-1">
                  <Button
                    size="md"
                    className="h-12 w-full px-4"
                    onClick={() => navigate('/orders/new')}
                    aria-label="New order"
                    title="New order"
                  >
                    <Plus className="size-5" aria-hidden />
                    New order
                  </Button>
                </div>
              )}
            </>
          }
        />
        <div className="mt-2 rounded-md border border-border bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
          {total.toLocaleString()} results
        </div>
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
          <div className="relative h-full max-md:min-w-0 max-md:max-w-full">
            <OrdersTable
              data={orders}
              sorting={sorting}
              onSortingChange={setSorting}
              onRowClick={(id) => navigate(`/orders/${id}`, { state: { from: '/orders' } })}
              hasMore={Boolean(hasNextPage)}
              isLoadingMore={isFetchingNextPage}
              onReachEnd={() => {
                if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
