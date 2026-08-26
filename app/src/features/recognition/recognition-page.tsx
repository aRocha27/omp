import { useEffect, useMemo, useState } from 'react'
import { ClipboardCopy, FileDown, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingBlock } from '@/components/ui/spinner'
import { Spinner } from '@/components/ui/spinner'
import {
  emptyRecognitionReportFilters,
  toRecognitionSearchFilters,
  type RecognitionReportFilters,
  type RecognitionReportRow,
} from '@/domain/models/recognition-report'
import { formatPrice } from '@/utils/format'
import {
  useRecognitionReportOptions,
  useRecognitionReportRows,
} from '@/features/recognition/api/use-recognition-report'
import {
  ActiveFilterChips,
  MultiSelectFilter,
} from '@/features/recognition/components/recognition-multi-select-filter'
import {
  buildRecognitionReportTsv,
  copyTextToClipboard,
  exportRecognitionReportToExcel,
  formatRecognitionRowForPreview,
} from '@/features/recognition/utils/recognition-export'

const MONTH_HEADERS: ReadonlyArray<{ key: keyof RecognitionReportRow; label: string }> = [
  { key: 'january', label: 'Jan' },
  { key: 'february', label: 'Feb' },
  { key: 'march', label: 'Mar' },
  { key: 'april', label: 'Apr' },
  { key: 'may', label: 'May' },
  { key: 'june', label: 'Jun' },
  { key: 'july', label: 'Jul' },
  { key: 'august', label: 'Aug' },
  { key: 'september', label: 'Sep' },
  { key: 'october', label: 'Oct' },
  { key: 'november', label: 'Nov' },
  { key: 'december', label: 'Dec' },
]

/**
 * Recognition report page.
 *
 * Surfaces every row of `dbo.V_Reconhecimento_Monthly_Crosstab` with the
 * dimensions the user wants to filter on. The page mirrors the Orders page
 * pattern: a filter bar at the top, the table in the middle, and two
 * companion actions — "Export to Excel" for the visible view, "Copy
 * selected" for the explicitly chosen rows.
 */
export function RecognitionPage() {
  const [filters, setFilters] = useState<RecognitionReportFilters>(emptyRecognitionReportFilters)
  const [selected, setSelected] = useState<readonly number[]>([])
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const limit = 1000

  const optionsQuery = useRecognitionReportOptions()
  const searchFilters = useMemo(() => toRecognitionSearchFilters(filters), [filters])
  const rowsQuery = useRecognitionReportRows(searchFilters, limit)

  const rows = rowsQuery.data ?? []
  const options = optionsQuery.data
  const allSelected = rows.length > 0 && selected.length === rows.length
  const someSelected = selected.length > 0 && !allSelected

  // Reset the selection set when the result set changes — orphaned ids would
  // be silently dropped, which confuses the "Copy selected" affordance.
  useEffect(() => {
    if (selected.length === 0) return
    const valid = new Set(rows.map((row) => rowKey(row)))
    setSelected((current) => current.filter((key) => valid.has(key)))
  }, [rows])

  function patchFilter<K extends keyof RecognitionReportFilters>(
    key: K,
    next: RecognitionReportFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: next }))
  }

  function toggleRow(row: RecognitionReportRow) {
    const key = rowKey(row)
    setSelected((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    )
  }

  function toggleAll() {
    if (allSelected) setSelected([])
    else setSelected(rows.map((row) => rowKey(row)))
  }

  async function handleCopy() {
    if (selected.length === 0) return
    const subset = rows.filter((row) => selected.includes(rowKey(row)))
    if (subset.length === 0) return
    const tsv = buildRecognitionReportTsv(subset)
    const ok = await copyTextToClipboard(tsv)
    setCopyState(ok ? 'copied' : 'error')
    if (ok) {
      window.setTimeout(() => setCopyState('idle'), 2000)
    } else {
      window.setTimeout(() => setCopyState('idle'), 3000)
    }
  }

  function handleExport() {
    if (rows.length === 0) return
    const today = new Date()
    const stamp = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`
    const fileName = `recognition-${stamp}.xlsx`
    exportRecognitionReportToExcel(rows, fileName)
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="shrink-0">
        <PageHeader
          title="Recognition"
          description="Year/month recognition crosstab from dbo.V_Reconhecimento_Monthly_Crosstab."
          actions={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => rowsQuery.refetch()}
                disabled={rowsQuery.isFetching}
                aria-label="Refresh recognition rows"
              >
                <RefreshCw
                  className={rowsQuery.isFetching ? 'size-4 animate-spin' : 'size-4'}
                  aria-hidden
                />
                Refresh
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleCopy}
                disabled={selected.length === 0}
                aria-label={
                  selected.length === 0
                    ? 'Copy selected rows (none selected)'
                    : `Copy ${selected.length} selected ${selected.length === 1 ? 'row' : 'rows'} to clipboard`
                }
                title={
                  selected.length === 0
                    ? 'Select at least one row to copy it to the clipboard.'
                    : 'Copy the selected rows to the clipboard as tab-separated values.'
                }
              >
                {copyState === 'copied' ? (
                  <ClipboardCopy className="size-4 text-success" aria-hidden />
                ) : copyState === 'error' ? (
                  <ClipboardCopy className="size-4 text-danger" aria-hidden />
                ) : (
                  <ClipboardCopy className="size-4" aria-hidden />
                )}
                {copyState === 'copied'
                  ? 'Copied'
                  : copyState === 'error'
                    ? 'Copy failed'
                    : `Copy selected (${selected.length})`}
              </Button>
              <Button
                size="sm"
                onClick={handleExport}
                disabled={rows.length === 0}
                aria-label={
                  rows.length === 0
                    ? 'Export to Excel (no rows to export)'
                    : `Export ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} to Excel`
                }
                title={
                  rows.length === 0
                    ? 'No rows to export. Adjust the filters to see at least one row.'
                    : 'Export the current view to an Excel file'
                }
              >
                <FileDown className="size-4" aria-hidden />
                Export
              </Button>
            </div>
          }
        />
      </div>

      <div className="shrink-0 rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelectFilter<number>
            label="Year_Recognition"
            options={options?.years ?? []}
            selected={filters.yearRecognition}
            onChange={(next) => patchFilter('yearRecognition', next)}
            formatOption={(year) => String(year)}
            emptyLabel="No years loaded"
          />
          <MultiSelectFilter<string>
            label="Area"
            options={options?.areas ?? []}
            selected={filters.area}
            onChange={(next) => patchFilter('area', next)}
            emptyLabel="No areas loaded"
          />
          <MultiSelectFilter<string>
            label="Grp_Report"
            options={options?.grpReports ?? []}
            selected={filters.grpReport}
            onChange={(next) => patchFilter('grpReport', next)}
            emptyLabel="No groups loaded"
          />
          <MultiSelectFilter<string>
            label="Tipo"
            options={options?.tipos ?? []}
            selected={filters.tipo}
            onChange={(next) => patchFilter('tipo', next)}
            emptyLabel="No tipos loaded"
          />
          <MultiSelectFilter<string>
            label="Produto"
            options={options?.produtos ?? []}
            selected={filters.produto}
            onChange={(next) => patchFilter('produto', next)}
            emptyLabel="No products loaded"
          />
          <MultiSelectFilter<string>
            label="Encomenda_Cli_PHC"
            options={options?.encomendas ?? []}
            selected={filters.encomendaCliPHC}
            onChange={(next) => patchFilter('encomendaCliPHC', next)}
            emptyLabel="No orders loaded"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFilters(emptyRecognitionReportFilters)}
            className="text-foreground/60"
          >
            Clear filters
          </Button>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <ActiveFilterChips<number>
            label="Years"
            selected={filters.yearRecognition}
            onRemove={(value) => patchFilter('yearRecognition', filters.yearRecognition.filter((v) => v !== value))}
            formatOption={(value) => String(value)}
            onClear={() => patchFilter('yearRecognition', [])}
          />
          <ActiveFilterChips<string>
            label="Areas"
            selected={filters.area}
            onRemove={(value) => patchFilter('area', filters.area.filter((v) => v !== value))}
            onClear={() => patchFilter('area', [])}
          />
          <ActiveFilterChips<string>
            label="Grp_Report"
            selected={filters.grpReport}
            onRemove={(value) => patchFilter('grpReport', filters.grpReport.filter((v) => v !== value))}
            onClear={() => patchFilter('grpReport', [])}
          />
          <ActiveFilterChips<string>
            label="Tipo"
            selected={filters.tipo}
            onRemove={(value) => patchFilter('tipo', filters.tipo.filter((v) => v !== value))}
            onClear={() => patchFilter('tipo', [])}
          />
          <ActiveFilterChips<string>
            label="Produto"
            selected={filters.produto}
            onRemove={(value) => patchFilter('produto', filters.produto.filter((v) => v !== value))}
            onClear={() => patchFilter('produto', [])}
          />
          <ActiveFilterChips<string>
            label="Encomenda"
            selected={filters.encomendaCliPHC}
            onRemove={(value) => patchFilter('encomendaCliPHC', filters.encomendaCliPHC.filter((v) => v !== value))}
            onClear={() => patchFilter('encomendaCliPHC', [])}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border bg-surface shadow-sm">
        {optionsQuery.isPending || rowsQuery.isPending ? (
          <div className="p-6">
            <LoadingBlock label="Loading recognition rows…" />
          </div>
        ) : rowsQuery.isError ? (
          <div className="p-6">
            <EmptyState
              icon={RefreshCw}
              title="Couldn’t load recognition rows"
              description={
                rowsQuery.error instanceof Error
                  ? rowsQuery.error.message
                  : 'Something went wrong.'
              }
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ClipboardCopy}
              title="No recognition rows"
              description="The current filters returned no rows. Try removing some filters."
            />
          </div>
        ) : (
          <table className="w-full min-w-[1600px] text-sm">
            <thead className="sticky top-0 z-10 border-b border-border bg-surface-muted text-left text-[11px] uppercase tracking-wider text-foreground/60">
              <tr>
                <th className="w-10 px-2 py-2">
                  <Checkbox
                    aria-label={allSelected ? 'Clear all selections' : 'Select all rows'}
                    checked={allSelected}
    onChange={toggleAll}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                  />
                </th>
                <th className="px-2 py-2">Year</th>
                <th className="px-2 py-2">Area</th>
                <th className="px-2 py-2">Grp_Report</th>
                <th className="px-2 py-2">Tipo</th>
                <th className="px-2 py-2">Produto</th>
                <th className="px-2 py-2">Encomenda_Cli_PHC</th>
                <th className="px-2 py-2">Cliente</th>
                <th className="px-2 py-2">Tp_Reconhecimento</th>
                <th className="px-2 py-2 text-right">Sell_Price</th>
                {MONTH_HEADERS.map((month) => (
                  <th key={month.key} className="px-2 py-2 text-right tabular-nums">
                    {month.label}
                  </th>
                ))}
                <th className="px-2 py-2 text-right">Total_Year</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = rowKey(row)
                const checked = selected.includes(key)
                return (
                  <tr
                    key={key}
                    className="border-b border-border/40 hover:bg-foreground/[0.02]"
                  >
                    <td className="px-2 py-1.5">
                      <Checkbox
                        aria-label={`Select row ${row.encomendaCliPHC ?? '—'} (${row.yearRecognition ?? '—'})`}
                        checked={checked}
                        onChange={() => toggleRow(row)}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-[12px] text-foreground/80">
                      {row.yearRecognition ?? '—'}
                    </td>
                    <td className="px-2 py-1.5 text-[12px] text-foreground/80">{row.area ?? '—'}</td>
                    <td className="px-2 py-1.5 text-[12px] text-foreground/80">
                      {row.grpReport ?? '—'}
                    </td>
                    <td className="px-2 py-1.5 text-[12px] text-foreground/80">{row.tipo ?? '—'}</td>
                    <td className="px-2 py-1.5 text-[12px] text-foreground/80">{row.produto ?? '—'}</td>
                    <td className="px-2 py-1.5 text-[12px] text-foreground/80">
                      {row.encomendaCliPHC ?? '—'}
                    </td>
                    <td className="px-2 py-1.5 text-[12px] text-foreground/80">
                      {row.cliente ?? '—'}
                    </td>
                    <td className="px-2 py-1.5 text-[12px] text-foreground/80">
                      {row.tpReconhecimento ?? '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right text-[12px] tabular-nums text-foreground/80">
                      {formatPrice(row.sellPrice)}
                    </td>
                    {MONTH_HEADERS.map((month) => (
                      <td
                        key={month.key}
                        className="px-2 py-1.5 text-right text-[12px] tabular-nums text-foreground/80"
                      >
                        {formatPrice(row[month.key] as number)}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right text-[12px] tabular-nums font-medium text-foreground">
                      {formatPrice(row.totalYear)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Hidden preview of the selected rows for screen-reader users — clicking
          the copy button on a row also exposes the formatted value. */}
      {selected.length > 0 && (
        <div
          aria-live="polite"
          className="sr-only"
        >
          {rows
            .filter((row) => selected.includes(rowKey(row)))
            .slice(0, 3)
            .map((row) => formatRecognitionRowForPreview(row))
            .join(' / ')}
        </div>
      )}

      {rowsQuery.isFetching && !rowsQuery.isPending && (
        <div className="pointer-events-none fixed bottom-4 right-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs shadow">
          <Spinner className="size-3" /> Refreshing…
        </div>
      )}
    </div>
  )
}

/**
 * Stable row key — the underlying view has no PK column, so we hash the
 * dimensional columns that uniquely identify a row.
 */
function rowKey(row: RecognitionReportRow): number {
  return [
    row.yearRecognition ?? 'null',
    row.area ?? '',
    row.grpReport ?? '',
    row.tipo ?? '',
    row.produto ?? '',
    row.encomendaCliPHC ?? '',
    row.tpReconhecimento ?? '',
  ]
    .join('\u0000')
    .split('')
    .reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 0)
}
