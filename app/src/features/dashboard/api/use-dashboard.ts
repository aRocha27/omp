import { useQuery } from '@tanstack/react-query'
import { useRepositories } from '@/app/providers/repository-provider'

export function useDashboard() {
  const { dashboard } = useRepositories()

  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboard.getSnapshot(),
    staleTime: 600_000,
    refetchInterval: 600_000,
  })
}

/**
 * Fetches the full recognition backlog (the rows from
 * dbo.[11-Reconhecimento-PorReconhecer] with `Valor por Reconhecer > 0`). Used by the
 * dashboard's "View all" modal so the user can browse every pending order without the
 * dashboard card's compact list. Query key is distinct from `useDashboard` so opening
 * the modal doesn't refetch the entire snapshot.
 */
export function useRecognitionQueue(enabled = true) {
  const { dashboard } = useRepositories()

  return useQuery({
    queryKey: ['dashboard', 'recognition-queue'],
    queryFn: () => dashboard.getRecognitionQueue(),
    enabled,
    staleTime: 600_000,
    refetchInterval: enabled ? 600_000 : false,
  })
}
