import { useQuery } from '@tanstack/react-query'
import { useRepositories } from '@/app/providers/repository-provider'
import type {
  PartialRecognitionReportFilters,
  RecognitionReportFacets,
  RecognitionReportFilters,
  RecognitionReportOptions,
  RecognitionReportRow,
} from '@/domain/models/recognition-report'

/**
 * Fetch the faceted option set for the Recognition filter bar.
 *
 * The query key includes the active filters so the facets narrow with the
 * user's selections (exclude-own-facet contract): changing any filter
 * value triggers a refetch against the new universe. The cached response
 * is keyed by the filter shape — no manual invalidation needed when the
 * user toggles selections.
 *
 * `staleTime` is 60 s (same as `useOrders`) so the filter bar does not
 * refetch on every micro-interaction but does pick up master-data changes
 * when the master-data page invalidates `['orders','facets']` (parity with
 * the Orders facet query).
 */
export function useRecognitionReportFacets(filters: PartialRecognitionReportFilters) {
  const { recognitionReport } = useRepositories()
  return useQuery<RecognitionReportFacets>({
    queryKey: ['recognition-report', 'facets', filters],
    queryFn: () => recognitionReport.facets(filters),
  })
}

/**
 * Legacy: fetch the distinct filter-option universe (no narrowing). Kept
 * for the legacy `GET /api/recognition/filter-options` endpoint and for
 * tests that want a one-shot snapshot. New callers should prefer
 * `useRecognitionReportFacets(filters)` so the option set narrows with
 * the active filters.
 */
export function useRecognitionReportOptions() {
  const { recognitionReport } = useRepositories()
  return useQuery<RecognitionReportOptions>({
    queryKey: ['recognition-report', 'options'],
    queryFn: () => recognitionReport.getFilterOptions(),
    staleTime: 600_000,
  })
}

/**
 * Fetch the rows for the current filter set. The query key includes the
 * filters so the same filter context hits the cache, and changing any
 * filter value invalidates automatically.
 */
export function useRecognitionReportRows(filters: RecognitionReportFilters, limit: number) {
  const { recognitionReport } = useRepositories()
  return useQuery<RecognitionReportRow[]>({
    queryKey: ['recognition-report', 'rows', filters, limit],
    queryFn: () => recognitionReport.list(filters, limit),
    staleTime: 600_000,
  })
}
