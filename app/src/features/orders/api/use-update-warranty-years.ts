import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useRepositories } from '@/app/providers/repository-provider'

/**
 * Updates the warranty-years (`N_Anos`) on `dbo.Tp_Warranty` for the order's matched
 * warranty type. The Invoice/Warranty table calls this from the per-row years editor.
 * On success the invoicing and dashboard queries are invalidated so the page refetches
 * and reflects the new value without flicker.
 */
export function useUpdateWarrantyYears() {
  const { orders } = useRepositories()
  const user = useCurrentUser()
  const queryClient = useQueryClient()

  return useMutation<boolean, Error, { id: number; years: number }>({
    mutationFn: ({ id, years }) => orders.updateWarrantyYears(id, years, user.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoicing'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'list'] })
    },
  })
}