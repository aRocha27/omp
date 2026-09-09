import { useState } from 'react'
import { FileDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/components/ui/cn'
import { exportOrdersToExcel, type ExportFilterLabels } from '@/utils/orders-export'
import type { OrderSummary } from '@/domain/models/order'

interface OrdersExportButtonProps {
  /** The visible page, used for the empty state and fallback export. */
  orders: readonly OrderSummary[]
  /** Slug-ready labels for the active filter context, used in the file name. */
  filterLabels: ExportFilterLabels
  /** Optional loader used when export must include rows beyond the visible page. */
  loadAllOrders?: () => Promise<readonly OrderSummary[]>
  /** When true, render a disabled button with a hint. Default: false. */
  disabled?: boolean
  /** Render as an icon-only square for compact toolbars. */
  compact?: boolean
  className?: string
}

/**
 * "Export to Excel" button for the orders list.
 *
 * The button writes a real .xlsx file (via SheetJS, loaded lazily on click so
 * the dependency never runs at module-evaluation time). The file contains
 * `loadAllOrders` can fetch every matching page before the file is generated,
 * so the 500-row viewport limit never truncates an export.
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
  loadAllOrders,
  disabled = false,
  compact = false,
  className,
}: OrdersExportButtonProps) {
  const [justExported, setJustExported] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const noRows = orders.length === 0

  async function handleClick() {
    if (noRows || disabled || isExporting) return
    setIsExporting(true)
    try {
      const exportRows = loadAllOrders ? await loadAllOrders() : orders
      if (exportRows.length === 0) return
      exportOrdersToExcel(exportRows, filterLabels)
      setJustExported(true)
      window.setTimeout(() => setJustExported(false), 2000)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={handleClick}
      disabled={disabled || noRows || isExporting}
      aria-label={
        noRows
          ? 'Export to Excel (no orders to export)'
          : loadAllOrders
            ? 'Export all matching orders to Excel'
            : `Export ${orders.length} ${orders.length === 1 ? 'order' : 'orders'} to Excel`
      }
      title={
        noRows
          ? 'No orders to export. Adjust the filters to see at least one row.'
          : loadAllOrders
            ? 'Export all matching orders to an Excel file'
            : 'Export the current view to an Excel file'
      }
      className={cn(compact ? 'size-8 !p-0' : undefined, className)}
    >
      {justExported ? (
        <Check className={cn('size-4', 'text-success')} aria-hidden />
      ) : (
        <FileDown className="size-4" aria-hidden />
      )}
      <span className={compact ? 'sr-only' : undefined}>
        {justExported ? 'Exported' : isExporting ? 'Exporting…' : 'Export'}
      </span>
    </Button>
  )
}
