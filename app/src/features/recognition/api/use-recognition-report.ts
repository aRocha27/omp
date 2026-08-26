import { useQuery } from '@tanstack/react-query'
import { useRepositories } from '@/app/providers/repository-provider'
import type {
  RecognitionReportFilters,
  RecognitionReportOptions,
  RecognitionReportRow,
} from '@/domain/models/recognition-report'

/**
 * Fetch the distinct filter-option universe for the Recognition report
 * (years, areas, grp_reports, tipos, produtos, encomendas). Cached for the
 * session via TanStack Query so reopening the tab doesn't refetch.
 */
export function useRecognitionReportOptions() {
  const { recognitionReport } = useRepositories()
  return useQuery<RecognitionReportOptions>({
    queryKey: ['recognition-report', 'options'],
    queryFn: () => recognitionReport.getFilterOptions(),
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
  })
}
