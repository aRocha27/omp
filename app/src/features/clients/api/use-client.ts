import { useQuery } from '@tanstack/react-query'
import { useRepositories } from '@/app/providers/repository-provider'

/**
 * Fetches a single client through the active `ClientsRepository`.
 *
 * The query is disabled when `id` is null so a missing/NaN id does not fire the
 * fetch — callers render the not-found state without a round-trip.
 */
export function useClient(id: number | null | undefined) {
  const { clients } = useRepositories()
  return useQuery({
    queryKey: ['clients', 'detail', id],
    // `enabled` guarantees `id` is non-null here, so the cast is safe.
    queryFn: () => clients.getById(id as number),
    enabled: id != null,
  })
}