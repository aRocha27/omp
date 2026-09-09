import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useRepositories } from '@/app/providers/repository-provider'
import { invalidateOrderAggregate } from './invalidate-order-aggregate'
import type { PropagateReconhecimentoInput } from '@/services/contracts/reconhecimento.repository'
import type { Reconhecimento } from '@/domain/models/reconhecimento'

/**
 * Generates monthly recognition lines for a warranty or maintenance-contract
 * order through the active `ReconhecimentoRepository`.
 *
 * `kind: 'warranty'` (only when `order.Tipo_Warranty` is true) seeds `WP` lines
 * from the warranty reserve; `kind: 'maintenance'` (only for `ID_Tipo === 'CM'`)
 * seeds `CM` lines from the Sell_Price over the contract term. The server
 * revalidates total capacity inside the propagation transaction.
 *
 * On success the generated rows are appended to the recognition list cache
 * directly so the Revenue tab shows them and the recomputed totals instantly,
 * without a refetch flash. The recognition list is then invalidated in the
 * background so the server re-sorts it by `DT_Reconhecimento` (appended rows may
 * land out of order); the cached rows remain on screen during the refetch, so
 * there is no flash. The detail and list queries are invalidated so the order's
 * `Reconhecido` flag catches up.
 */
export function usePropagateReconhecimento(orderId: number) {
  const { reconhecimentos } = useRepositories()
  const user = useCurrentUser()
  const queryClient = useQueryClient()

  return useMutation<Reconhecimento[], Error, PropagateReconhecimentoInput>({
    mutationFn: (input) => reconhecimentos.propagate(orderId, input, user.role),
    onSuccess: (created) => {
      queryClient.setQueryData<Reconhecimento[]>(['orders', 'reconhecimentos', orderId], (old) => [
        ...(old ?? []),
        ...created,
      ])
      queryClient.invalidateQueries({ queryKey: ['orders', 'reconhecimentos', orderId] })
       invalidateOrderAggregate(queryClient, orderId)
    },
  })
}
