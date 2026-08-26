import { useQuery } from '@tanstack/react-query'
import { useRepositories } from '@/app/providers/repository-provider'

/**
 * Fetches the full Área list through the active `ReferenceRepository`.
 *
 * Áreas are the cascade root — no parent filter — so the query key is static and
 * the result is cached for the session. Powers the Área dropdown in the create form
 * and the Área filter/label resolution.
 */
export function useAreas(options: { enabled?: boolean } = {}) {
  const { reference } = useRepositories()
  return useQuery({
    queryKey: ['reference', 'areas'],
    queryFn: () => reference.listAreas(),
    staleTime: Infinity,
    enabled: options.enabled ?? true,
  })
}