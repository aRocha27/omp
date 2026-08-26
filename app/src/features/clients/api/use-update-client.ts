import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useRepositories } from '@/app/providers/repository-provider'
import type { Client } from '@/domain/models/client'
import type { ClientUpdatePatch } from '@/services/contracts/clients.repository'

export function useUpdateClient(id: number) {
  const { clients } = useRepositories()
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  return useMutation<Client, Error, ClientUpdatePatch>({
    mutationFn: (patch) => clients.update(id, patch, user.role),
    onSuccess: (client) => {
      queryClient.setQueryData(['clients', 'detail', client.ID_Cliente], client)
      queryClient.invalidateQueries({ queryKey: ['clients', 'list'] })
    },
  })
}
