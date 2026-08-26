/**
 * Recognition report export / clipboard helpers.
 *
 * The export mirrors the visible table 1:1 (column order, labels, value
 * formatting) so the spreadsheet and the "Copy selected" output are
 * interchangeable snapshots. Currency / number cells are kept as raw
 * numbers so Excel formats them as money and SUM() works on them; the
 * visible `€` prefix is added by the table renderer only.
 */
import { utils, writeFile, type WorkSheet } from 'xlsx'
import { formatPrice } from '@/utils/format'
import type { RecognitionReportRow } from '@/domain/models/recognition-report'

interface Column {
  key: keyof RecognitionReportRow
  header: string
  /** Default cell extractor; falls back to the raw value. */
  read: (row: RecognitionReportRow) => string | number
}

const MONTH_COLUMNS: ReadonlyArray<{ key: keyof RecognitionReportRow; label: string }> = [
  { key: 'january', label: 'January' },
  { key: 'february', label: 'February' },
  { key: 'march', label: 'March' },
  { key: 'april', label: 'April' },
  { key: 'may', label: 'May' },
  { key: 'june', label: 'June' },
  { key: 'july', label: 'July' },
  { key: 'august', label: 'August' },
  { key: 'september', label: 'September' },
  { key: 'october', label: 'October' },
  { key: 'november', label: 'November' },
  { key: 'december', label: 'December' },
]

const COLUMNS: readonly Column[] = [
  { key: 'yearRecognition', header: 'Year', read: (row) => row.yearRecognition ?? '' },
  { key: 'area', header: 'Area', read: (row) => row.area ?? '' },
  { key: 'grpReport', header: 'Grp_Report', read: (row) => row.grpReport ?? '' },
  { key: 'tipo', header: 'Tipo', read: (row) => row.tipo ?? '' },
  { key: 'produto', header: 'Produto', read: (row) => row.produto ?? '' },
  { key: 'encomendaCliPHC', header: 'Encomenda_Cli_PHC', read: (row) => row.encomendaCliPHC ?? '' },
  { key: 'cliente', header: 'Cliente', read: (row) => row.cliente ?? '' },
  { key: 'sellPrice', header: 'Sell_Price', read: (row) => row.sellPrice ?? '' },
  { key: 'tpReconhecimento', header: 'Tp_Reconhecimento', read: (row) => row.tpReconhecimento ?? '' },
  ...MONTH_COLUMNS.map((month) => ({
    key: month.key,
    header: month.label,
    read: (row: RecognitionReportRow) => row[month.key] as number,
  })),
  { key: 'totalYear', header: 'Total_Year', read: (row) => row.totalYear },
]

/** Build a TSV string (Excel paste-friendly) with a header row. */
export function buildRecognitionReportTsv(rows: readonly RecognitionReportRow[]): string {
  const header = COLUMNS.map((c) => c.header).join('\t')
  const body = rows.map((row) =>
    COLUMNS.map((c) => String(c.read(row)).replace(/[\t\r\n]+/g, ' ')).join('\t'),
  )
  return [header, ...body].join('\n')
}

/** Build the XLSX worksheet from the given rows. Exposed for tests. */
export function buildRecognitionReportWorksheet(
  rows: readonly RecognitionReportRow[],
): WorkSheet {
  const header = COLUMNS.map((c) => c.header)
  const data = rows.map((row) =>
    Object.fromEntries(COLUMNS.map((c) => [c.header, c.read(row)])),
  )
  return utils.json_to_sheet(data, { header })
}

/** Trigger a browser download of the rows as an .xlsx file. */
export function exportRecognitionReportToExcel(
  rows: readonly RecognitionReportRow[],
  fileName: string,
): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return
  const worksheet = buildRecognitionReportWorksheet(rows)
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, worksheet, 'Recognition')
  writeFile(workbook, fileName)
}

/** Copy a TSV payload to the system clipboard, with a graceful fallback. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through to the legacy fallback
    }
  }
  if (typeof document === 'undefined') return false
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  } finally {
    document.body.removeChild(textarea)
  }
  return ok
}

/** Format a single row as a human-readable multi-line string for previews. */
export function formatRecognitionRowForPreview(row: RecognitionReportRow): string {
  const lines: string[] = []
  lines.push(`${row.yearRecognition ?? '—'} · ${row.cliente ?? '—'} · ${row.encomendaCliPHC ?? '—'}`)
  lines.push(`Area: ${row.area ?? '—'}  Tipo: ${row.tipo ?? '—'}  Produto: ${row.produto ?? '—'}`)
  lines.push(
    `Sell_Price: ${formatPrice(row.sellPrice)}  Total_Year: ${formatPrice(row.totalYear)}`,
  )
  return lines.join('\n')
}
