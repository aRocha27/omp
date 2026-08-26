import { useState } from 'react'
import { FileDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import {
  exportOrdersToExcel,
  type ExportFilterLabels,
} from '@/utils/orders-export'
import type { OrderSummary } from '@/domain/models/order'

interface OrdersExportButtonProps {
  /** The orders currently visible in the table. The export mirrors this list
   *  — no re-fetch, no silent server-side filtering. */
  orders: readonly OrderSummary[]
  /** Slug-ready labels for the active filter context, used in the file name. */
  filterLabels: ExportFilterLabels
  /** When true, render a disabled button with a hint. Default: false. */
  disabled?: boolean
}

/**
 * "Export to Excel" button for the orders list.
 *
 * The button writes a real .xlsx file (via SheetJS, loaded lazily on click so
 * the dependency never runs at module-evaluation time). The file contains
 * exactly the rows the user can see in the table — column order, resolved
 * labels, and `dd/mm/yyyy` date format — so the spreadsheet is a faithful
 * snapshot, not a re-query of the database.
 *
 * The file name is `order-<active-filter-slugs>-<dd-mm-yyyy>.xlsx` so two
 * exports on the same day with different filters don't overwrite each other
 * in the user's Downloads folder. When no filter is active it falls back to
 * `order-26-08-2026.xlsx`.
 *
 * Feedback: a brief "Exported" chip replaces the icon for 2s after the
 * download fires, so the user knows the click landed. Spinner is left out
 * — the file is generated synchronously and the click handler returns in
 * a few ms even for hundreds of rows.
 */
export function OrdersExportButton({
  orders,
  filterLabels,
  disabled = false,
}: OrdersExportButtonProps) {
  const [justExported, setJustExported] = useState(false)
  const noRows = orders.length === 0

  function handleClick() {
    if (noRows || disabled) return
    exportOrdersToExcel(orders, filterLabels)
    setJustExported(true)
    window.setTimeout(() => setJustExported(false), 2000)
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={handleClick}
      disabled={disabled || noRows}
      aria-label={
        noRows
          ? 'Export to Excel (no orders to export)'
          : `Export ${orders.length} ${orders.length === 1 ? 'order' : 'orders'} to Excel`
      }
      title={
        noRows
          ? 'No orders to export. Adjust the filters to see at least one row.'
          : 'Export the current view to an Excel file'
      }
    >
      {justExported ? (
        <Check className={cn('size-4', 'text-success')} aria-hidden />
      ) : (
        <FileDown className="size-4" aria-hidden />
      )}
      {justExported ? 'Exported' : 'Export'}
    </Button>
  )
}
