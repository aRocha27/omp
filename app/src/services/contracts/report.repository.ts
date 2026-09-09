import type { BacklogReportRow, YearlyBacklogReportRow } from '@/domain/models/report'
export interface BacklogReportFilters { dataInicial?: string; dataFinal?: string; area?: string; grpReport?: string; produto?: string }
export interface ReportRepository { backlog(filters?: BacklogReportFilters): Promise<BacklogReportRow[]>; backlogToday(): Promise<BacklogReportRow[]>; yearlyToday(): Promise<YearlyBacklogReportRow[]> }
