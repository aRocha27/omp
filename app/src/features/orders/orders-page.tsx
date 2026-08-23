import { useMemo, useState } from 'react'
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

const emptyFilters: OrdersFiltersValue = {
  clientName: '',
  orderFactory: '',
  idTpOrder: '',
  negocioFechado: '',
  dateFrom: '',
  dateTo: '',
}

export function OrdersPage() {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const [filters, setFilters] = useState<OrdersFiltersValue>(emptyFilters)

  const searchFilters = useMemo(() => toSearchFilters(filters), [filters])
  const { data, isPending, isError, error } = useOrders(searchFilters)

  const showCreate = canEdit(user)
  const orders = data ?? []
  const hasActiveFilters = Object.values(filters).some((v) => v !== '')

  return (
    <div>
      <PageHeader
        title="Orders"
        description="All orders, newest first."
        actions={
          showCreate && (
            <Button size="sm" onClick={() => navigate('/orders/new')}>
              <Plus className="size-4" aria-hidden />
              New order
            </Button>
          )
        }
      />

      <OrdersFilters value={filters} onChange={setFilters} />

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
            showCreate && !hasActiveFilters ? (
              <Button size="sm" onClick={() => navigate('/orders/new')}>
                <Plus className="size-4" aria-hidden />
                New order
              </Button>
            ) : undefined
          }
        />
      ) : (
        <OrdersTable data={orders} />
      )}
    </div>
  )
}