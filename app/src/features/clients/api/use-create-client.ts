import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useRepositories } from '@/app/providers/repository-provider'
import type { Client } from '@/domain/models/client'
import type { ClientCreateInput } from '@/services/contracts/clients.repository'

export function useCreateClient() {
  const { clients } = useRepositories()
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  return useMutation<Client, Error, ClientCreateInput>({
    mutationFn: (input) => clients.create(input, user.role),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ['clients', 'list'] })
      queryClient.setQueryData(['clients', 'detail', client.ID_Cliente], client)
    },
  })
}
