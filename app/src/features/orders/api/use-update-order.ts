import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useRepositories } from '@/app/providers/repository-provider'
import type { OrderUpdatePatch } from '@/services/contracts/orders.repository'
import type { Order } from '@/domain/models/order'

/**
 * Updates an order through the active `OrdersRepository`.
 *
 * The active role (from `useCurrentUser`) is forwarded so the live backend can
 * enforce field-level locks; the mock trusts the UI, which already disables
 * locked fields (domain/orders/order-policy).
 *
 * On success the detail cache is updated in place (no flash) and the list query
 * is invalidated so the row reflects the change on the next background refetch.
 */
export function useUpdateOrder() {
  const { orders } = useRepositories()
  const user = useCurrentUser()
  const queryClient = useQueryClient()

  return useMutation<Order, Error, { id: number; patch: OrderUpdatePatch }>({
    mutationFn: ({ id, patch }) => orders.update(id, patch, user.role),
    onSuccess: (updated, { id }) => {
      // Optimistic detail update — no refetch, no UI flash.
      queryClient.setQueryData<Order>(['orders', 'detail', id], updated)
      // The list row may change (price, flags, dates) — refetch in the background.
      queryClient.invalidateQueries({ queryKey: ['orders', 'list'] })
    },
  })
}