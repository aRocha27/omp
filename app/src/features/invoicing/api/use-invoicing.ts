import { useQuery } from '@tanstack/react-query'
import { useRepositories } from '@/app/providers/repository-provider'

export function useInvoicing() {
  const { invoicing } = useRepositories()

  return useQuery({
    queryKey: ['invoicing'],
    queryFn: () => invoicing.getSnapshot(),
    staleTime: 600_000,
    refetchInterval: 600_000,
  })
}
