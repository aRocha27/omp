import { useQuery } from '@tanstack/react-query'
import { useRepositories } from '@/app/providers/repository-provider'

/**
 * Fetches Produtos through the active `ReferenceRepository`, optionally narrowed by
 * the selected Área. When `area` is `undefined` every produto is returned (the
 * non-cascaded filter dropdown); when set, only that area's products come back —
 * the dependent dropdown in the create/detail cascade.
 *
 * `enabled` gates the fetch on a non-empty `area` for the cascaded call sites so an
 * absent Área doesn't trigger a full-list fetch the dropdown would discard.
 */
export function useProdutos({
  area,
  enabled = true,
}: { area?: string | null; enabled?: boolean } = {}) {
  const { reference } = useRepositories()
  const resolved = area ?? undefined
  return useQuery({
    queryKey: ['reference', 'produtos', resolved ?? 'all'],
    queryFn: () => reference.listProdutos(resolved),
    staleTime: Infinity,
    enabled,
  })
}