import { useQuery } from '@tanstack/react-query'
import { useRepositories } from '@/app/providers/repository-provider'

/**
 * Fetches the Facturacao (invoicing documents) entries for a single order
 * through the active `DocumentoFaturacaoRepository`.
 *
 * The query is disabled when `orderId` is null/undefined so a missing id does
 * not fire the fetch — callers render the empty state without a round-trip.
 */
export function useDocumentoFaturacaoTypes() {
  const { facturacao } = useRepositories()
  return useQuery({
    queryKey: ['orders', 'facturacao', 'types'],
    queryFn: () => facturacao.listTypes(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useDocumentoFaturacao(orderId: number | null | undefined) {
  const { facturacao } = useRepositories()
  return useQuery({
    queryKey: ['orders', 'facturacao', orderId],
    // `enabled` guarantees `orderId` is non-null here, so the cast is safe.
    queryFn: () => facturacao.listByOrder(orderId as number),
    enabled: orderId != null,
  })
}