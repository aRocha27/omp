import { useQuery } from '@tanstack/react-query'
import { useRepositories } from '@/app/providers/repository-provider'

/**
 * Fetches the Reconhecimento (revenue recognition) entries for a single order
 * through the active `ReconhecimentoRepository`.
 *
 * The query is disabled when `orderId` is null/undefined so a missing id does
 * not fire the fetch — callers render the empty state without a round-trip.
 *
 * TODO: add a `useAddReconhecimento` mutation hook when the `[+ Reconhecimento]`
 * button lands; for now the detail page calls `reconhecimentos.add` directly.
 */
export function useReconhecimentos(orderId: number | null | undefined, enabled = true) {
  const { reconhecimentos } = useRepositories()
  return useQuery({
    queryKey: ['orders', 'reconhecimentos', orderId],
    // `enabled` guarantees `orderId` is non-null here, so the cast is safe.
    queryFn: () => reconhecimentos.listByOrder(orderId as number),
    enabled: orderId != null && enabled,
  })
}
