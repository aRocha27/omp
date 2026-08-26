/**
 * Export the current Orders list to an .xlsx file.
 *
 * The export mirrors what the user sees in the table: every column from the
 * orders grid (IDs and codes + their resolved labels) plus a row per order in
 * the current filter context. The date is rendered as `dd/mm/yyyy` to match
 * the rest of the app's display locale, and currency values are plain numbers
 * so Excel formats them as money (the table shows the `€` prefix; the .xlsx
 * cells stay raw for spreadsheet math).
 *
 * `xlsx` (SheetJS) is loaded lazily inside the function so the dependency
 * never runs at module-evaluation time. Tests that need to assert the file
 * bytes use the underlying helpers directly.
 */
import { utils, writeFile, type WorkSheet } from 'xlsx'
import {
  areaLabel,
  instrumentoLabel,
  orderTypeLabel,
  produtoLabel,
  revenueLabel,
  tipoLabel,
  warrantyLabel,
} from '@/features/orders/components/reference-labels'
import { formatOrderDate } from '@/utils/format'
import type { OrderSummary } from '@/domain/models/order'

/** Column definitions for the exported sheet.
 *
 * The order matches the visible grid (left-to-right) so the spreadsheet reads
 * exactly like the table the user just clicked from. Labels are kept in
 * English (matching the grid headers) so the file is locale-stable across
 * teammates. */
export const EXPORT_COLUMNS: readonly { key: keyof OrderSummary; header: string }[] = [
  { key: 'ID_Order', header: 'ID' },
  { key: 'ID_Tp_Order', header: 'Order type' },
  { key: 'Encomenda_Cli_PHC', header: 'SAP Order' },
  { key: 'DT_Order', header: 'Date' },
  { key: 'Client_Name', header: 'Client' },
  { key: 'ID_Area', header: 'Area' },
  { key: 'ID_Tipo', header: 'Type' },
  { key: 'ID_Produto', header: 'Product' },
  { key: 'ID_Instrumento', header: 'Instrument' },
  { key: 'Sell_Price', header: 'Sell price' },
  { key: 'Negocio_Fechado', header: 'Deal closed' },
  { key: 'Order_Factory', header: 'Factory' },
  { key: 'Kit', header: 'Kit' },
  { key: 'ID_Tp_Warranty', header: 'Warranty type' },
  { key: 'Warranty_Reserve', header: 'Warranty reserve' },
  { key: 'Warranty_DT_Inicio', header: 'Warranty start' },
  { key: 'Orc_Proposta', header: 'Budget ref' },
  { key: 'PO_Cliente', header: 'Customer PO' },
  { key: 'ID_Tp_Revenue', header: 'Revenue type' },
]

/** Resolve a single column's value to a spreadsheet-friendly cell.
 *
 * IDs (string codes) become their resolved label so the spreadsheet reads
 * naturally; the raw code is preserved in the next column for traceability.
 * Dates are pre-formatted to `dd/mm/yyyy` to match the app's display locale.
 * Booleans become `Yes` / `No` to match the table; numbers stay numbers. */
function cellFor(order: OrderSummary, key: keyof OrderSummary): string | number | null {
  const raw = order[key]
  switch (key) {
    case 'ID_Tp_Order':
      return orderTypeLabel(raw as string | null) ?? ''
    case 'ID_Area':
      return areaLabel(raw as string | null) ?? ''
    case 'ID_Tipo':
      return tipoLabel(raw as string | null) ?? ''
    case 'ID_Produto':
      return produtoLabel(raw as number | null) ?? ''
    case 'ID_Instrumento':
      return instrumentoLabel(raw as number | null) ?? ''
    case 'ID_Tp_Warranty':
      return warrantyLabel(raw as number | null) ?? ''
    case 'ID_Tp_Revenue':
      return revenueLabel(raw as number | null) ?? ''
    case 'DT_Order':
    case 'Warranty_DT_Inicio':
      return formatOrderDate(raw as string | null) || ''
    case 'Negocio_Fechado':
    case 'Order_Factory':
    case 'Kit':
      return raw === true ? 'Yes' : raw === false ? 'No' : ''
    case 'Sell_Price':
    case 'Warranty_Reserve':
      return typeof raw === 'number' ? raw : null
    default:
      // IDs, free-text fields (SAP Order, Budget ref, Customer PO, Client)
      return raw == null ? '' : (raw as string | number)
  }
}

/** Build the worksheet from the given orders. Exposed so tests can assert
 * the row/column shape without going through `XLSX.writeFile`. */
export function buildOrdersWorksheet(orders: readonly OrderSummary[]): WorkSheet {
  const headerRow = EXPORT_COLUMNS.map((c) => c.header)
  const rows = orders.map((o) =>
    Object.fromEntries(EXPORT_COLUMNS.map((c) => [c.header, cellFor(o, c.key)])),
  )
  const worksheet = utils.json_to_sheet(rows, { header: headerRow })
  return worksheet
}

/** Build the workbook (single sheet named "Orders") from the given orders. */
export function buildOrdersWorkbook(orders: readonly OrderSummary[]) {
  const worksheet = buildOrdersWorksheet(orders)
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, worksheet, 'Orders')
  return workbook
}

/** Slugify a value for the file name: keep letters / digits / underscore, lowercase
 * the rest, collapse runs of separators. Empty / missing values yield `null` so
 * the caller can skip them. */
function slugify(value: string | null | undefined): string | null {
  if (value == null) return null
  const cleaned = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return cleaned === '' ? null : cleaned
}

/** Date stamp used in the file name, dd-mm-yyyy (per the user's spec —
 * distinct from the ISO yyyy-mm-dd stored in app state so the OS file picker
 * sorts the name in the same order as Excel's date cell). */
function todayDdMmYyyy(date: Date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

/** Human-readable bits of the active filter, in the order they appear in the bar. */
export interface ExportFilterLabels {
  clientName: string | null
  orderType: string | null
  area: string | null
  tipo: string | null
  product: string | null
  instrument: string | null
  sapOrder: string | null
  dateFrom: string | null
  dateTo: string | null
  factoryOnly: boolean
  closedOnly: boolean
}

/** Build the file name for a given filter context.
 *
 * Pattern: `order-<active-slugs>-<dd-mm-yyyy>.xlsx`. Only active filters
 * contribute a slug — empty/cleared filters are skipped, so a freshly opened
 * list exports as `order-26-08-2026.xlsx`. Slugs are joined by `-`; trailing
 * separators are trimmed. */
export function buildOrdersFileName(
  filters: ExportFilterLabels,
  date: Date = new Date(),
): string {
  const slugs: string[] = []
  if (filters.clientName) slugs.push(slugify(`client-${filters.clientName}`)!)
  if (filters.orderType) slugs.push(slugify(`type-${filters.orderType}`)!)
  if (filters.area) slugs.push(slugify(`area-${filters.area}`)!)
  if (filters.tipo) slugs.push(slugify(`kind-${filters.tipo}`)!)
  if (filters.product) slugs.push(slugify(`product-${filters.product}`)!)
  if (filters.instrument) slugs.push(slugify(`instrument-${filters.instrument}`)!)
  if (filters.sapOrder) slugs.push(slugify(`sap-${filters.sapOrder}`)!)
  if (filters.dateFrom) slugs.push(slugify(`from-${filters.dateFrom}`)!)
  if (filters.dateTo) slugs.push(slugify(`to-${filters.dateTo}`)!)
  if (filters.factoryOnly) slugs.push('factory')
  if (filters.closedOnly) slugs.push('closed')
  const datePart = todayDdMmYyyy(date)
  const prefix = slugs.length > 0 ? `order-${slugs.join('-')}` : 'order'
  return `${prefix}-${datePart}.xlsx`
}

/** Trigger a browser download of the orders in `orders` as an .xlsx file.
 * No-op outside the browser (SSR / tests without `document`).
 *
 * Returns the file name so the caller can show a "Downloaded <name>" toast. */
export function exportOrdersToExcel(
  orders: readonly OrderSummary[],
  filters: ExportFilterLabels,
  date: Date = new Date(),
): string {
  const fileName = buildOrdersFileName(filters, date)
  const workbook = buildOrdersWorkbook(orders)
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return fileName
  }
  // `writeFile` triggers a download via a temporary <a download> element.
  // SheetJS auto-selects the format from the file name extension.
  writeFile(workbook, fileName)
  return fileName
}
