import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useRepositories } from '@/app/providers/repository-provider'
import type { Order } from '@/domain/models/order'
import type { OrderCreateInput } from '@/services/contracts/orders.repository'

export function useCreateOrder() {
  const { orders } = useRepositories()
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  return useMutation<Order, Error, OrderCreateInput>({
    mutationFn: (input) => orders.create(input, user.role),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders', 'list'] })
      queryClient.setQueryData(['orders', 'detail', order.ID_Order], order)
    },
  })
}
