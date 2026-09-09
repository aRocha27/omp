import type { BacklogReportRow, YearlyBacklogReportRow } from '@/domain/models/report'
import type { BacklogReportFilters, ReportRepository } from '@/services/contracts/report.repository'
import { getJsonReadOnly, postJsonReadOnly } from './_shared'
export class HttpReportRepository implements ReportRepository {
  async backlog(filters?: BacklogReportFilters): Promise<BacklogReportRow[]> {
    const data = await postJsonReadOnly<{ ok: true; rows: BacklogReportRow[] }>('/reports/backlog', filters ?? {})
    return data.rows
  }
  async backlogToday(): Promise<BacklogReportRow[]> {
    const data = await getJsonReadOnly<{ ok: true; rows: BacklogReportRow[] }>('/reports/backlog-today')
    return data.rows
  }
  async yearlyToday(): Promise<YearlyBacklogReportRow[]> {
    const data = await getJsonReadOnly<{ ok: true; rows: YearlyBacklogReportRow[] }>('/reports/backlog-yearly-today')
    return data.rows
  }
}
