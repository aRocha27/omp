import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useRepositories } from '@/app/providers/repository-provider'
import type {
  KitConsumablePatch,
  NewKitConsumable,
} from '@/services/contracts/kit-consumable.repository'
import type { KitConsumable } from '@/domain/models/kit-consumable'

const KIT_CONSUMABLES_KEY = ['orders', 'kit-consumables'] as const

/**
 * Fetches the Kit_Consumables entries for a single order through the active
 * `KitConsumableRepository`. Drives the order-detail Kit tab sub-table and the
 * Saldo computation (Kit_Amount − Σ Total_Price).
 *
 * The query is disabled when `orderId` is null/undefined so a missing id does
 * not fire the fetch — callers render the empty state without a round-trip.
 */
export function useKitConsumables(orderId: number | null | undefined) {
  const { kitConsumables } = useRepositories()
  return useQuery({
    queryKey: [...KIT_CONSUMABLES_KEY, orderId] as const,
    // `enabled` guarantees `orderId` is non-null here, so the cast is safe.
    queryFn: () => kitConsumables.listByOrder(orderId as number),
    enabled: orderId != null,
  })
}

/**
 * Appends a Kit_Consumables entry through the active `KitConsumableRepository`.
 *
 * On success the returned row is appended to the kit-consumables list cache
 * directly so the Kit tab sub-table and the Saldo (Kit_Amount − Σ Total_Price)
 * recompute instantly, without a refetch flash.
 */
export function useAddKitConsumable(orderId: number) {
  const { kitConsumables } = useRepositories()
  const user = useCurrentUser()
  const queryClient = useQueryClient()

  return useMutation<KitConsumable, Error, NewKitConsumable>({
    mutationFn: (entry) => kitConsumables.add(entry, user.role),
    onSuccess: (created) => {
      queryClient.setQueryData<KitConsumable[]>(
        [...KIT_CONSUMABLES_KEY, orderId] as const,
        (old) => [...(old ?? []), created],
      )
    },
  })
}

/**
 * Edits a Kit_Consumables entry through the active `KitConsumableRepository`.
 *
 * On success the returned entry replaces the matching row in the kit-consumables
 * list cache directly so the Kit tab and the Saldo recompute instantly, without
 * a refetch flash.
 */
export function useUpdateKitConsumable(orderId: number) {
  const { kitConsumables } = useRepositories()
  const user = useCurrentUser()
  const queryClient = useQueryClient()

  return useMutation<KitConsumable, Error, { id: number; patch: KitConsumablePatch }>({
    mutationFn: ({ id, patch }) => kitConsumables.update(id, patch, user.role),
    onSuccess: (updated) => {
      queryClient.setQueryData<KitConsumable[]>(
        [...KIT_CONSUMABLES_KEY, orderId] as const,
        (old) =>
          old?.map((row) => (row.ID_Kit === updated.ID_Kit ? updated : row)) ?? [updated],
      )
    },
  })
}

/**
 * Hard-deletes a Kit_Consumables entry through the active
 * `KitConsumableRepository` (dbo.Kit_Consumables has no deleted_at).
 *
 * The row is removed optimistically from the kit-consumables list cache (with a
 * snapshot rolled back on error) so the Kit tab and the Saldo recompute
 * instantly rather than waiting for a refetch.
 */
export function useDeleteKitConsumable(orderId: number) {
  const { kitConsumables } = useRepositories()
  const user = useCurrentUser()
  const queryClient = useQueryClient()

  return useMutation<void, Error, { id: number }, { previous: KitConsumable[] | undefined }>({
    mutationFn: ({ id }) => kitConsumables.remove(id, user.role),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({
        queryKey: [...KIT_CONSUMABLES_KEY, orderId] as const,
      })
      const previous = queryClient.getQueryData<KitConsumable[]>([
        ...KIT_CONSUMABLES_KEY,
        orderId,
      ])
      queryClient.setQueryData<KitConsumable[]>(
        [...KIT_CONSUMABLES_KEY, orderId] as const,
        (old) => old?.filter((row) => row.ID_Kit !== id) ?? [],
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData([...KIT_CONSUMABLES_KEY, orderId], context.previous)
      }
    },
  })
}