import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useRepositories } from '@/app/providers/repository-provider'
import type { ReconhecimentoPatch } from '@/services/contracts/reconhecimento.repository'
import type { Reconhecimento } from '@/domain/models/reconhecimento'
import { invalidateOrderAggregate } from './invalidate-order-aggregate'

/**
 * Edits a Reconhecimento entry through the active `ReconhecimentoRepository`.
 *
 * On success the returned entry replaces the matching row in the recognition
 * list cache directly — the Revenue tab reflects the edit instantly, without a
 * refetch flash, and the recomputed totals (instrument/warranty split, "por
 * reconhecer", green-highlight math) update in the same render. The detail and
 * list queries are invalidated in the background so the order's `Reconhecido`
 * flag (computed server-side) catches up.
 */
export function useUpdateReconhecimento(orderId: number) {
  const { reconhecimentos } = useRepositories()
  const user = useCurrentUser()
  const queryClient = useQueryClient()

  return useMutation<Reconhecimento, Error, { id: number; patch: ReconhecimentoPatch }>({
    mutationFn: ({ id, patch }) => reconhecimentos.update(id, patch, user.role),
    onSuccess: (updated) => {
      queryClient.setQueryData<Reconhecimento[]>(
        ['orders', 'reconhecimentos', orderId],
        (old) =>
          old?.map((row) =>
            row.ID_Reconhecimento === updated.ID_Reconhecimento ? updated : row,
          ) ?? [updated],
      )
       invalidateOrderAggregate(queryClient, orderId)
    },
  })
}
