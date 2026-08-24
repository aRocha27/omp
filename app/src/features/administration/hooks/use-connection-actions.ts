import { useMutation, useQuery } from '@tanstack/react-query'
import {
  connect,
  listProfiles,
  listTables,
  syncAllTables,
  syncOrders,
  type ConnectionSource,
} from '@/features/administration/api/admin-api'

export function useBackendProfiles(adminToken?: string) {
  return useQuery({
    queryKey: ['administration', 'database-profiles'],
    queryFn: () => listProfiles(adminToken),
    retry: false,
  })
}

export function useConnectionActions(adminToken?: string) {
  const connectMutation = useMutation({
    mutationFn: (source: ConnectionSource) => connect(source, adminToken),
  })
  const tablesMutation = useMutation({
    mutationFn: (source: ConnectionSource) => listTables(source, adminToken),
  })
  const syncMutation = useMutation({
    mutationFn: (input: {
      source: ConnectionSource
      schema: string
      table: string
      limit?: number
    }) => syncOrders(input, adminToken),
  })
  const syncAllMutation = useMutation({
    mutationFn: (input: { source: ConnectionSource; limit?: number }) =>
      syncAllTables(input, adminToken),
  })

  return { connectMutation, tablesMutation, syncMutation, syncAllMutation }
}
