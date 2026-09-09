import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  GripVertical,
  RefreshCw,
  X,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingBlock } from '@/components/ui/spinner'
import { useRepositories } from '@/app/providers/repository-provider'
import { useRecognitionReportRows } from '@/features/recognition/api/use-recognition-report'
import { useAreas } from '@/features/orders/api/use-areas'
import { emptyRecognitionReportFilters } from '@/domain/models/recognition-report'
import type { BacklogReportFilters } from '@/services/contracts/report.repository'
import type { BacklogReportRow } from '@/domain/models/report'
import { formatPrice } from '@/utils/format'
import { utils, writeFile } from 'xlsx'
import {
  ActiveFilterChips,
  MultiSelectFilter,
} from '@/features/recognition/components/recognition-multi-select-filter'
import { PivotTable, pivotMeasures, type PivotMeasureKey } from './pivot-table'
import { openCrosstabPrintReport } from './crosstab-report'

type Dimension =
  | 'idArea'
  | 'area'
  | 'idTipo'
  | 'tipo'
  | 'idProduto'
  | 'produto'
  | 'idGrpReport'
  | 'grpReport'
  | 'encomendaCliPHC'
const dimensions: { id: Dimension; label: string }[] = [
  { id: 'idArea', label: 'ID_Area' },
  { id: 'area', label: 'Area' },
  { id: 'idTipo', label: 'ID_Tipo' },
  { id: 'tipo', label: 'Type' },
  { id: 'idProduto', label: 'ID_Produto' },
  { id: 'produto', label: 'Product' },
  { id: 'idGrpReport', label: 'ID_Grp_Report' },
  { id: 'grpReport', label: 'Grp_Report' },
  { id: 'encomendaCliPHC', label: 'Encomenda_CLI_phc' },
]
const moneyHeaders = ['Backlog_Start', 'NOB', 'Revenue', 'Backlog_End'] as const
const moneySortKeys: Record<(typeof moneyHeaders)[number], string> = {
  Backlog_Start: 'backlogStart',
  NOB: 'nob',
  Revenue: 'revenue',
  Backlog_End: 'backlogEnd',
}

export function ReportsPage() {
  const { report } = useRepositories()
  const [startDate, setStartDate] = useState(() => loadReportFilters().startDate)
  const [endDate, setEndDate] = useState(() => loadReportFilters().endDate)
  const [areaFilter, setAreaFilter] = useState<string[]>(() => loadReportFilters().area)
  const [grpReportFilter, setGrpReportFilter] = useState<string[]>(
    () => loadReportFilters().grpReport,
  )
  const [produtoFilter, setProdutoFilter] = useState<string[]>([])
  const [execution, setExecution] = useState(0)
  const areasQuery = useAreas()
  const selectedAreaIds = useMemo(
    () =>
      new Set(
        (areasQuery.data ?? [])
          .filter((option) => areaFilter.includes(option.label))
          .map((option) => option.id),
      ),
    [areaFilter, areasQuery.data],
  )
  const backlogFilters = useMemo<BacklogReportFilters>(
    () => ({
      dataInicial: startDate || undefined,
      dataFinal: endDate || undefined,
      area: areaFilter.join(',') || undefined,
      grpReport: grpReportFilter.join(',') || undefined,
    }),
    [areaFilter, endDate, grpReportFilter, startDate],
  )
  const backlog = useQuery({
    queryKey: ['reports', 'backlog', execution],
    queryFn: () => report.backlog(backlogFilters),
    enabled: execution > 0,
    staleTime: 300_000,
  })
  const backlogYearlyToday = useQuery({
    queryKey: ['reports', 'backlog-yearly-today'],
    queryFn: () => report.yearlyToday(),
    staleTime: 300_000,
  })
  const backlogToday = useQuery({
    queryKey: ['reports', 'backlog-today'],
    queryFn: () => report.backlogToday(),
    staleTime: 300_000,
  })
  const recognition = useRecognitionReportRows(emptyRecognitionReportFilters, 5000)
  const [open, setOpen] = useState({
    pivot: true,
    yearly: false,
    detail: false,
    recognition: false,
  })
  const [rows, setRows] = useState<Dimension[]>(['area', 'grpReport', 'tipo'])
  const [columns, setColumns] = useState<Dimension[]>([])
  const [values, setValues] = useState<PivotMeasureKey[]>(
    pivotMeasures.map((measure) => measure.key),
  )
  const [dragged, setDragged] = useState<Dimension | null>(null)
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: 'ano', desc: true })
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [resizing, setResizing] = useState<{
    key: string
    startX: number
    startWidth: number
  } | null>(null)

  const data = useMemo(() => backlog.data ?? [], [backlog.data])
  // The current procedure applies dates in SQL and no longer returns Ano/Mes.
  const timelineData = data
  const filterOptions = useMemo(
    () => ({
      areas:
        areasQuery.data?.map((option) => option.label) ??
        uniqueValues(timelineData.map((row) => row.area)),
      groups: uniqueValues([...timelineData.map((row) => row.grpReport), 'Product', 'Service']),
      products: [] as string[],
    }),
    [areasQuery.data, timelineData],
  )
  const crosstabData = useMemo(
    () =>
      timelineData.filter(
        (row) =>
          (areaFilter.length === 0 || selectedAreaIds.has(row.idArea ?? '')) &&
          (grpReportFilter.length === 0 || grpReportFilter.includes(row.grpReport ?? '')),
      ),
    [areaFilter, grpReportFilter, selectedAreaIds, timelineData],
  )
  const sortedRecognition = useMemo(
    () => sortRows(recognition.data ?? [], sort),
    [recognition.data, sort],
  )
  const todayExportRows = useMemo(
    () =>
      (backlogToday.data ?? []).map((row) => ({
        Ano: row.ano,
        Area: row.area,
        Tipo: row.tipo,
        Grp_Report: row.grpReport,
        Backlog_Start: row.backlogStart,
        NOB: row.nob,
        Revenue: row.revenue,
        Backlog_End: row.backlogEnd,
      })),
    [backlogToday.data],
  )
  const yearlyExportRows = useMemo(
    () =>
      (backlogYearlyToday.data ?? []).map((row) => ({
        Ano: row.ano,
        Backlog_Start: row.backlogStart,
        NOB: row.nob,
        Revenue: row.revenue,
        Backlog_End: row.backlogEnd,
      })),
    [backlogYearlyToday.data],
  )
  const crosstabExportRows = useMemo(
    () => buildPivotExportRows(crosstabData, rows, columns, values),
    [columns, crosstabData, rows, values],
  )

  function moveDimension(dimension: Dimension, target: 'rows' | 'columns' | 'available') {
    setRows((current) =>
      target === 'rows'
        ? [...current.filter((v) => v !== dimension), dimension]
        : current.filter((v) => v !== dimension),
    )
    setColumns((current) =>
      target === 'columns'
        ? [...current.filter((v) => v !== dimension), dimension]
        : current.filter((v) => v !== dimension),
    )
  }
  function toggleSort(key: string) {
    setSort((current) => ({ key, desc: current.key === key ? !current.desc : false }))
  }
  const reload = () => {
    if (execution > 0) setExecution((value) => value + 1)
    void backlogYearlyToday.refetch()
    void backlogToday.refetch()
    void recognition.refetch()
  }
  useEffect(() => {
    try {
      sessionStorage.setItem(
        'omp:reports-filters',
        JSON.stringify({ startDate, endDate, area: areaFilter, grpReport: grpReportFilter }),
      )
    } catch {
      // Storage can be unavailable in private browsing or restricted webviews.
    }
  }, [areaFilter, endDate, grpReportFilter, startDate])
  useEffect(() => {
    if (!resizing) return
    const activeResize = resizing
    function move(event: MouseEvent) {
      setColumnWidths((current) => ({
        ...current,
        [activeResize.key]: Math.max(
          80,
          activeResize.startWidth + event.clientX - activeResize.startX,
        ),
      }))
    }
    function stop() {
      setResizing(null)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', stop)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', stop)
    }
  }, [resizing])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader
        title="Reports"
        description="Explore backlog and recognition data from the operational views."
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={reload}
            disabled={
              backlog.isFetching ||
              backlogYearlyToday.isFetching ||
              backlogToday.isFetching ||
              recognition.isFetching
            }
          >
            <RefreshCw
              className={
                backlog.isFetching || backlogYearlyToday.isFetching || backlogToday.isFetching
                  ? 'size-4 animate-spin'
                  : 'size-4'
              }
            />
            Refresh
          </Button>
        }
      />
      <div className="shrink-0 rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/60">
          <span className="font-semibold text-foreground">Build a view</span>
          <span>Drag dimensions between Rows and Columns.</span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          {(['rows', 'columns'] as const).map((zone) => (
            <div
              key={zone}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragged && moveDimension(dragged, zone)}
              className="min-h-16 rounded-md border border-dashed border-border-strong bg-surface-muted p-2"
            >
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
                {zone}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(zone === 'rows' ? rows : columns).map((id) => (
                  <div
                    draggable
                    key={id}
                    onDragStart={() => setDragged(id)}
                    className="inline-flex items-center gap-1 rounded bg-primary-muted px-2 py-1 text-xs font-medium text-primary"
                  >
                    <GripVertical className="size-3" />
                    <span>{label(id)}</span>
                    <button
                      onClick={() => moveDimension(id, 'available')}
                      aria-label={`Disable ${label(id)} filter`}
                      className="ml-1 text-primary hover:text-primary/70"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="min-h-16 rounded-md border border-dashed border-border-strong bg-surface-muted p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
              Sum measures
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pivotMeasures.map((measure) => {
                const active = values.includes(measure.key)
                return (
                  <button
                    key={measure.key}
                    type="button"
                    onClick={() =>
                      setValues((current) =>
                        active
                          ? current.filter((value) => value !== measure.key)
                          : [...current, measure.key],
                      )
                    }
                    className={
                      active
                        ? 'inline-flex items-center rounded bg-primary-muted px-2 py-1 text-xs font-medium text-primary'
                        : 'inline-flex items-center rounded border border-border bg-surface px-2 py-1 text-xs text-foreground/60'
                    }
                  >
                    {measure.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="min-h-16 rounded-md border border-dashed border-border-strong bg-surface-muted p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
              Available filters
            </div>
            <div className="flex flex-wrap gap-1.5">
              {dimensions
                .map((dimension) => dimension.id)
                .filter((id) => !columns.includes(id) && !rows.includes(id))
                .map((id) => (
                  <div
                    draggable
                    key={id}
                    onDragStart={() => setDragged(id)}
                    className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs text-foreground/60"
                  >
                    <GripVertical className="size-3" />
                    <span>{label(id)}</span>
                    <button
                      onClick={() => moveDimension(id, 'rows')}
                      aria-label={`Enable ${label(id)} as a row`}
                      className="ml-1 text-primary hover:text-primary/70"
                    >
                      +
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
      <ReportSection
        title="Crosstab explorer"
        subtitle={`${crosstabData.length.toLocaleString()} source rows`}
        expanded={open.pivot}
        onToggle={() => setOpen((v) => ({ ...v, pivot: !v.pivot }))}
        action={
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={crosstabExportRows.length <= 1}
              onClick={() =>
                openCrosstabPrintReport({
                  rows: crosstabExportRows,
                  measureCount: values.length,
                  filters: {
                    startDate,
                    endDate,
                    area: areaFilter,
                    grpReport: grpReportFilter,
                    produto: produtoFilter,
                  },
                })
              }
            >
              Create Report
            </Button>
            <PivotExportButton
              rows={crosstabExportRows}
              dimensionCount={rows.length + columns.length}
              name="crosstab-explorer"
            />
          </div>
        }
      >
        <div className="mb-3 rounded-md bg-surface-muted p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
              Start date
              <DatePicker
                aria-label="Start date"
                value={startDate || null}
                onChange={(next) => setStartDate(next ?? '')}
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
              End date
              <DatePicker
                aria-label="End date"
                value={endDate || null}
                onChange={(next) => setEndDate(next ?? '')}
              />
            </label>
            <MultiSelectFilter
              label="Area"
              options={filterOptions.areas}
              selected={areaFilter}
              onChange={setAreaFilter}
              emptyLabel="No areas"
            />
            <MultiSelectFilter
              label="Grp_Report"
              options={filterOptions.groups}
              selected={grpReportFilter}
              onChange={setGrpReportFilter}
              emptyLabel="No groups"
            />
            <MultiSelectFilter
              label="Product"
              options={filterOptions.products}
              selected={produtoFilter}
              onChange={setProdutoFilter}
              emptyLabel="No products"
            />
            <Button
              size="sm"
              onClick={() => setExecution((value) => value + 1)}
              disabled={!startDate || !endDate}
            >
              Run
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setStartDate('')
                setEndDate('')
                setAreaFilter([])
                setGrpReportFilter([])
                setProdutoFilter([])
                setExecution(0)
              }}
            >
              Clear filters
            </Button>
            <span className="pb-2 text-xs text-foreground/50">
              {execution === 0
                ? 'Configure filters and run the report'
                : `${crosstabData.length.toLocaleString()} rows in selected filters`}
            </span>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            <ActiveFilterChips
              label="Area"
              selected={areaFilter}
              onRemove={(value) => setAreaFilter(areaFilter.filter((entry) => entry !== value))}
              onClear={() => setAreaFilter([])}
            />
            <ActiveFilterChips
              label="Grp_Report"
              selected={grpReportFilter}
              onRemove={(value) =>
                setGrpReportFilter(grpReportFilter.filter((entry) => entry !== value))
              }
              onClear={() => setGrpReportFilter([])}
            />
            <ActiveFilterChips
              label="Product"
              selected={produtoFilter}
              onRemove={(value) =>
                setProdutoFilter(produtoFilter.filter((entry) => entry !== value))
              }
              onClear={() => setProdutoFilter([])}
            />
          </div>
        </div>
        {execution === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Crosstab not executed"
            description="Choose the filters and select Run to load the report."
          />
        ) : backlog.isPending ? (
          <LoadingBlock label="Loading backlog report…" />
        ) : backlog.isError ? (
          <EmptyState
            icon={RefreshCw}
            title="Couldn’t load backlog report"
            description="Check the server connection and try again."
          />
        ) : crosstabData.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No results"
            description="No rows match the selected filters."
          />
        ) : values.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No values selected"
            description="Choose at least one measure in Values."
          />
        ) : (
          <PivotTable data={crosstabData} rows={rows} columns={columns} values={values} />
        )}
      </ReportSection>
      <ReportSection
        title="Backlog by year (today)"
        subtitle={`${(backlogYearlyToday.data ?? []).length.toLocaleString()} rows · V_NOB_Revenue_Backlog_YearlyToday`}
        expanded={open.yearly}
        onToggle={() => setOpen((v) => ({ ...v, yearly: !v.yearly }))}
        action={<ExportButton rows={yearlyExportRows} name="backlog-yearly-today" />}
      >
        {backlogYearlyToday.isPending ? (
          <LoadingBlock label="Loading yearly backlog report…" />
        ) : backlogYearlyToday.isError ? (
          <EmptyState
            icon={RefreshCw}
            title="Couldn’t load yearly backlog report"
            description="Check the server connection and try again."
          />
        ) : yearlyExportRows.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No yearly results"
            description="The yearly backlog view returned no rows."
          />
        ) : (
          <ResizableTable>
            <table className="w-full min-w-[760px] table-fixed text-xs">
              <thead className="sticky top-0 z-10">
                <tr>
                  {['ano', ...moneyHeaders].map((h) => {
                    const sortKey = moneyHeaders.includes(h as (typeof moneyHeaders)[number])
                      ? moneySortKeys[h as (typeof moneyHeaders)[number]]
                      : h
                    return (
                      <SortableHead
                        key={h}
                        label={h}
                        sortKey={sortKey}
                        sort={sort}
                        onSort={toggleSort}
                        numeric={moneyHeaders.includes(h as (typeof moneyHeaders)[number])}
                        width={columnWidths[h]}
                        onResize={(event) => {
                          event.preventDefault()
                          setResizing({
                            key: h,
                            startX: event.clientX,
                            startWidth: columnWidths[h] ?? 140,
                          })
                        }}
                      />
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sortRows(backlogYearlyToday.data ?? [], sort).map((row, index) => (
                  <tr
                    key={`${row.ano}-${index}`}
                    className="border-b border-border/40 odd:bg-surface-muted/50 hover:bg-primary-muted/40"
                  >
                    <td className="px-3 py-2 font-medium text-foreground/80">{row.ano ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground/80">
                      {formatPrice(row.backlogStart)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground/80">
                      {formatPrice(row.nob)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground/80">
                      {formatPrice(row.revenue)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">
                      {formatPrice(row.backlogEnd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResizableTable>
        )}
      </ReportSection>
      <ReportSection
        title="Backlog detail (today)"
        subtitle={`${(backlogToday.data ?? []).length.toLocaleString()} rows · V_NOB_Revenue_Backlog_DetailToday · complete export`}
        expanded={open.detail}
        onToggle={() => setOpen((v) => ({ ...v, detail: !v.detail }))}
        action={<ExportButton rows={todayExportRows} name="backlog-detail-today" />}
      >
        <ResizableTable>
          <table className="w-full min-w-[980px] table-fixed text-xs">
            <thead className="sticky top-0 z-10">
              <tr>
                {['ano', 'area', 'tipo', 'grpReport', ...moneyHeaders].map((h) => {
                  const sortKey = moneyHeaders.includes(h as (typeof moneyHeaders)[number])
                    ? moneySortKeys[h as (typeof moneyHeaders)[number]]
                    : h
                  return (
                    <SortableHead
                      key={h}
                      label={h}
                      sortKey={sortKey}
                      sort={sort}
                      onSort={toggleSort}
                      numeric={moneyHeaders.includes(h as (typeof moneyHeaders)[number])}
                      width={columnWidths[h]}
                      onResize={(event) => {
                        event.preventDefault()
                        setResizing({
                          key: h,
                          startX: event.clientX,
                          startWidth: columnWidths[h] ?? 140,
                        })
                      }}
                    />
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sortRows(backlogToday.data ?? [], sort).map((r, i) => (
                <tr
                  key={`${r.ano}-${r.area}-${r.tipo}-${i}`}
                  className="border-b border-border/40 odd:bg-surface-muted/50 hover:bg-primary-muted/40"
                >
                  <td className="w-20 whitespace-nowrap px-3 py-2 font-medium text-foreground/80">
                    {r.ano ?? '—'}
                  </td>
                  <td
                    className="w-36 truncate px-3 py-2 text-foreground/80"
                    title={r.area ?? undefined}
                  >
                    {r.area ?? '—'}
                  </td>
                  <td
                    className="w-56 truncate px-3 py-2 text-foreground/80"
                    title={r.tipo ?? undefined}
                  >
                    {r.tipo ?? '—'}
                  </td>
                  <td
                    className="w-32 truncate px-3 py-2 text-foreground/80"
                    title={r.grpReport ?? undefined}
                  >
                    {r.grpReport ?? '—'}
                  </td>
                  <td className="w-36 whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground/80">
                    {formatPrice(r.backlogStart)}
                  </td>
                  <td className="w-36 whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground/80">
                    {formatPrice(r.nob)}
                  </td>
                  <td className="w-36 whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground/80">
                    {formatPrice(r.revenue)}
                  </td>
                  <td className="w-36 whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium text-foreground">
                    {formatPrice(r.backlogEnd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResizableTable>
      </ReportSection>
      <ReportSection
        title="Recognition monthly crosstab"
        subtitle={`${sortedRecognition.length.toLocaleString()} rows · complete export`}
        expanded={open.recognition}
        onToggle={() => setOpen((v) => ({ ...v, recognition: !v.recognition }))}
        action={<ExportButton rows={sortedRecognition} name="recognition-monthly" />}
      >
        <ResizableTable>
          <table className="w-full min-w-[1300px] text-xs">
            <thead>
              <tr>
                {[
                  'yearRecognition',
                  'area',
                  'grpReport',
                  'tipo',
                  'produto',
                  'encomendaCliPHC',
                  'cliente',
                  'totalYear',
                ].map((h) => (
                  <SortableHead key={h} label={h} sortKey={h} sort={sort} onSort={toggleSort} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRecognition.map((r, i) => (
                <tr key={`${r.encomendaCliPHC}-${i}`} className="border-b border-border/40">
                  <td>{r.yearRecognition ?? '—'}</td>
                  <td>{r.area ?? '—'}</td>
                  <td>{r.grpReport ?? '—'}</td>
                  <td>{r.tipo ?? '—'}</td>
                  <td>{r.produto ?? '—'}</td>
                  <td>{r.encomendaCliPHC ?? '—'}</td>
                  <td>{r.cliente ?? '—'}</td>
                  <td>{formatPrice(r.totalYear)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResizableTable>
      </ReportSection>
    </div>
  )
}

function label(id: Dimension) {
  return dimensions.find((d) => d.id === id)?.label ?? id
}
function sortRows<T extends object>(data: T[], sort: { key: string; desc: boolean }) {
  return [...data].sort((a, b) => {
    const left = (a as Record<string, unknown>)[sort.key] ?? ''
    const right = (b as Record<string, unknown>)[sort.key] ?? ''
    const result =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right))
    return sort.desc ? -result : result
  })
}
function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
  numeric = false,
  width,
  onResize,
}: {
  label: string
  sortKey: string
  sort: { key: string; desc: boolean }
  onSort: (key: string) => void
  numeric?: boolean
  width?: number
  onResize?: (event: React.MouseEvent<HTMLSpanElement>) => void
}) {
  return (
    <th
      style={width ? { width } : undefined}
      className={`relative whitespace-nowrap border-b border-border bg-surface-muted px-2 py-2 text-left text-[10px] uppercase tracking-wider text-foreground/60 ${numeric ? 'text-right' : ''}`}
    >
      <button onClick={() => onSort(sortKey)}>
        {label}
        {sort.key === sortKey ? (sort.desc ? ' ↓' : ' ↑') : ''}
      </button>
      {onResize && (
        <span
          role="separator"
          aria-label={`Resize ${label} column`}
          onMouseDown={onResize}
          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/50"
        />
      )}
    </th>
  )
}
function uniqueValues(values: (string | null)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b),
  )
}
function loadReportFilters(): {
  startDate: string
  endDate: string
  area: string[]
  grpReport: string[]
  produto: string[]
} {
  const empty: {
    startDate: string
    endDate: string
    area: string[]
    grpReport: string[]
    produto: string[]
  } = { startDate: '', endDate: '', area: [], grpReport: [], produto: [] }
  if (typeof window === 'undefined') return empty
  try {
    const stored = sessionStorage.getItem('omp:reports-filters')
    if (!stored) return empty
    const parsed = JSON.parse(stored) as Partial<typeof empty>
    return {
      startDate: typeof parsed.startDate === 'string' ? parsed.startDate : '',
      endDate: typeof parsed.endDate === 'string' ? parsed.endDate : '',
      area: Array.isArray(parsed.area)
        ? parsed.area.filter((value): value is string => typeof value === 'string')
        : [],
      grpReport: Array.isArray(parsed.grpReport)
        ? parsed.grpReport.filter((value): value is string => typeof value === 'string')
        : [],
      produto: Array.isArray(parsed.produto)
        ? parsed.produto.filter((value): value is string => typeof value === 'string')
        : [],
    }
  } catch {
    return empty
  }
}
function ReportSection({
  title,
  subtitle,
  expanded,
  onToggle,
  action,
  children,
}: {
  title: string
  subtitle: string
  expanded: boolean
  onToggle: () => void
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      className={`shrink-0 overflow-hidden rounded-lg border border-border bg-surface shadow-sm ${title === 'Crosstab explorer' ? '[&_.mt-2.flex-col]:hidden [&_.mb-3>div>div.relative:nth-of-type(3)]:hidden' : ''}`}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button onClick={onToggle} className="flex min-w-0 items-center gap-2 text-left">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <span className="font-semibold">{title}</span>
          <span className="hidden text-xs text-foreground/50 sm:inline">{subtitle}</span>
        </button>
        {action}
      </div>
      {expanded && <div className="border-t border-border p-3">{children}</div>}
    </section>
  )
}
function ResizableTable({ children }: { children: ReactNode }) {
  return (
    <div className="max-h-[430px] resize-y overflow-auto rounded border border-border/60">
      {children}
    </div>
  )
}
function ExportButton({ rows, name }: { rows: unknown[]; name: string }) {
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => {
        const workbook = utils.book_new()
        utils.book_append_sheet(workbook, utils.json_to_sheet(rows), 'Report')
        writeFile(workbook, `${name}-${new Date().toISOString().slice(0, 10)}.xlsx`)
      }}
    >
      <Download className="size-4" />
      Export Excel
    </Button>
  )
}
function PivotExportButton({
  rows,
  dimensionCount,
  name,
}: {
  rows: (string | number)[][]
  dimensionCount: number
  name: string
}) {
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={rows.length <= 1}
      onClick={() => {
        const workbook = utils.book_new()
        const sheet = utils.aoa_to_sheet(rows)
        for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1)
          for (let columnIndex = dimensionCount; columnIndex < rows[0].length; columnIndex += 1) {
            const cell = sheet[utils.encode_cell({ r: rowIndex, c: columnIndex })]
            if (cell) cell.z = '€#,##0.00'
          }
        sheet['!cols'] = rows[0].map((header) => ({
          wch: Math.min(36, Math.max(12, String(header).length + 2)),
        }))
        utils.book_append_sheet(workbook, sheet, 'Crosstab')
        writeFile(workbook, `${name}-${new Date().toISOString().slice(0, 10)}.xlsx`)
      }}
    >
      <Download className="size-4" />
      Export Excel
    </Button>
  )
}
function buildPivotExportRows(
  data: BacklogReportRow[],
  rowFields: Dimension[],
  columnFields: Dimension[],
  measureKeys: PivotMeasureKey[],
): (string | number)[][] {
  const fields = [...rowFields, ...columnFields]
  const header = [
    ...fields.map(label),
    ...measureKeys.map((key) => pivotMeasures.find((measure) => measure.key === key)?.label ?? key),
  ]
  const groups = new Map<string, { dimensions: (string | number)[]; totals: number[] }>()
  for (const row of data) {
    const dimensions = fields.map((field) =>
      String((row as unknown as Record<string, unknown>)[field] ?? '—'),
    )
    const key = JSON.stringify(dimensions)
    const group = groups.get(key) ?? { dimensions, totals: measureKeys.map(() => 0) }
    measureKeys.forEach((measure, index) => {
      group.totals[index] += row[measure]
    })
    groups.set(key, group)
  }
  return [header, ...[...groups.values()].map((group) => [...group.dimensions, ...group.totals])]
}
