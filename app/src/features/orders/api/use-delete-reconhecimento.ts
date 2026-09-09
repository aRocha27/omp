import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useRepositories } from '@/app/providers/repository-provider'
import type { Reconhecimento } from '@/domain/models/reconhecimento'
import { invalidateOrderAggregate } from './invalidate-order-aggregate'

/**
 * Hard-deletes a Reconhecimento entry through the active
 * `ReconhecimentoRepository` (dbo.Reconhecimento has no deleted_at).
 *
 * The row is removed optimistically from the recognition list cache (with a
 * snapshot rolled back on error) so the Revenue tab drops it instantly rather
 * than waiting for a refetch. The detail and list queries are invalidated in
 * the background so the order's `Reconhecido` flag catches up.
 */
export function useDeleteReconhecimento(orderId: number) {
  const { reconhecimentos } = useRepositories()
  const user = useCurrentUser()
  const queryClient = useQueryClient()

  return useMutation<void, Error, { id: number }, { previous: Reconhecimento[] | undefined }>({
    mutationFn: ({ id }) => reconhecimentos.remove(id, user.role),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['orders', 'reconhecimentos', orderId] })
      const previous = queryClient.getQueryData<Reconhecimento[]>([
        'orders',
        'reconhecimentos',
        orderId,
      ])
      queryClient.setQueryData<Reconhecimento[]>(
        ['orders', 'reconhecimentos', orderId],
        (old) => old?.filter((row) => row.ID_Reconhecimento !== id) ?? [],
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['orders', 'reconhecimentos', orderId], context.previous)
      }
    },
    onSuccess: () => {
      invalidateOrderAggregate(queryClient, orderId)
    },
  })
}
