import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useRepositories } from '@/app/providers/repository-provider'
import type { DocumentoFaturacao } from '@/domain/models/documento-faturacao'

/**
 * Hard-deletes a Facturacao entry through the active
 * `DocumentoFaturacaoRepository` (dbo.Facturacao has no deleted_at).
 *
 * The row is removed optimistically from the invoicing list cache (with a
 * snapshot rolled back on error) so the Invoicing tab drops it instantly rather
 * than waiting for a refetch. The detail query is invalidated in the background
 * so the order's `Facturado` flag catches up.
 */
export function useDeleteDocumentoFaturacao(orderId: number) {
  const { facturacao } = useRepositories()
  const user = useCurrentUser()
  const queryClient = useQueryClient()

  return useMutation<void, Error, { id: number }, { previous: DocumentoFaturacao[] | undefined }>({
    mutationFn: ({ id }) => facturacao.remove(id, user.role),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['orders', 'facturacao', orderId] })
      const previous = queryClient.getQueryData<DocumentoFaturacao[]>([
        'orders',
        'facturacao',
        orderId,
      ])
      queryClient.setQueryData<DocumentoFaturacao[]>(
        ['orders', 'facturacao', orderId],
        (old) => old?.filter((row) => row.ID_Facturacao !== id) ?? [],
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['orders', 'facturacao', orderId], context.previous)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'list'] })
    },
  })
}
