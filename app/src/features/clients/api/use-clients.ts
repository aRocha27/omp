import { useQuery } from '@tanstack/react-query'
import { useRepositories } from '@/app/providers/repository-provider'
import { normaliseClientFilters, type ClientSearchFilters } from '@/domain/models/client'

/**
 * Fetches the client list through the active `ClientsRepository`.
 *
 * Filters are normalised before being passed to the repository so empty
 * search/empty arrays never reach the data layer. The query key includes the
 * normalised filters so cached results are stable.
 */
export function useClients(filters: ClientSearchFilters) {
  const { clients } = useRepositories()
  const normalised = normaliseClientFilters(filters)

  return useQuery({
    queryKey: ['clients', 'list', normalised],
    queryFn: () => clients.search(filters),
  })
}