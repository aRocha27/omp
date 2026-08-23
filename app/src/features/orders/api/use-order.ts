import { useQuery } from '@tanstack/react-query'
import { useRepositories } from '@/app/providers/repository-provider'

/**
 * Fetches a single order through the active `OrdersRepository`.
 *
 * The query is disabled when `id` is null/undefined so a missing/NaN id does
 * not fire the fetch — callers render the not-found state without a round-trip.
 */
export function useOrder(id: number | null | undefined) {
  const { orders } = useRepositories()
  return useQuery({
    queryKey: ['orders', 'detail', id],
    // `enabled` guarantees `id` is non-null here, so the cast is safe.
    queryFn: () => orders.getById(id as number),
    enabled: id != null,
  })
}