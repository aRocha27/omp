import { useQuery } from '@tanstack/react-query'
import { useRepositories } from '@/app/providers/repository-provider'

/**
 * Fetches Instrumentos through the active `ReferenceRepository`, optionally narrowed
 * by the selected Produto. When `produto` is `undefined` every instrumento is
 * returned (the non-cascaded filter dropdown); when set, only that produto's
 * instrumentos come back — the leaf of the Área → Produto → Instrumento cascade.
 */
export function useInstrumentos({
  produto,
  enabled = true,
}: { produto?: number | null; enabled?: boolean } = {}) {
  const { reference } = useRepositories()
  const resolved = produto ?? undefined
  return useQuery({
    queryKey: ['reference', 'instrumentos', resolved ?? 'all'],
    queryFn: () => reference.listInstrumentos(resolved),
    staleTime: Infinity,
    enabled,
  })
}