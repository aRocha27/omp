import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useRepositories } from '@/app/providers/repository-provider'
import type { DocumentoFaturacaoPatch } from '@/services/contracts/documento-faturacao.repository'
import type { DocumentoFaturacao } from '@/domain/models/documento-faturacao'
import { invalidateOrderAggregate } from './invalidate-order-aggregate'

/**
 * Edits a Facturacao (invoicing document) entry through the active
 * `DocumentoFaturacaoRepository`.
 *
 * On success the returned document replaces the matching row in the invoicing
 * list cache directly — the Invoicing tab reflects the edit instantly, without
 * a refetch flash, and the recomputed net-invoiced total (and its green
 * highlight when it equals Sell_Price) updates in the same render. The detail
 * query is invalidated in the background so the order's `Facturado` flag catches
 * up.
 */
export function useUpdateDocumentoFaturacao(orderId: number) {
  const { facturacao } = useRepositories()
  const user = useCurrentUser()
  const queryClient = useQueryClient()

  return useMutation<DocumentoFaturacao, Error, { id: number; patch: DocumentoFaturacaoPatch }>({
    mutationFn: ({ id, patch }) => facturacao.update(id, patch, user.role),
    onSuccess: (updated) => {
      queryClient.setQueryData<DocumentoFaturacao[]>(
        ['orders', 'facturacao', orderId],
        (old) =>
          old?.map((row) => (row.ID_Facturacao === updated.ID_Facturacao ? updated : row)) ?? [
            updated,
          ],
      )
      invalidateOrderAggregate(queryClient, orderId)
    },
  })
}
