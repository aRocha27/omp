import { useQuery } from '@tanstack/react-query'
import { useRepositories } from '@/app/providers/repository-provider'
import { normaliseOrderFilters, type OrderSearchFilters } from '@/domain/models/order'

/**
 * Fetches the order list through the active `OrdersRepository`.
 *
 * Filters are normalised before being passed to the repository so empty
 * strings/undefined never reach the data layer (MOCK_DATA_CONTRACT §4). The
 * query key includes the normalised filters so cached results are stable.
 */
export function useOrders(filters: OrderSearchFilters) {
  const { orders } = useRepositories()
  const normalised = normaliseOrderFilters(filters)

  return useQuery({
    queryKey: ['orders', 'list', normalised],
    queryFn: () => orders.search(normalised),
  })
}