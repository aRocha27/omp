import { Maximize2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { DashboardRecognitionQueueItem } from '@/domain/models/dashboard'
import { Button } from '@/components/ui/button'
import { formatOrderDate, formatPrice } from '@/utils/format'

interface DashboardRecognitionQueueProps {
  rows: DashboardRecognitionQueueItem[]
  /** Optional slot rendered next to the heading; used for the "View all" action. */
  action?: ReactNode
}

/**
 * Fixed-height (in `xl`) scrollable container so a long "to recognize" backlog cannot
 * blow out the dashboard grid. At smaller breakpoints the panel grows with its content —
 * the dashboard page already scrolls vertically inside `<main>` so it stays usable on
 * narrow viewports.
 */
const SCROLLABLE_HEIGHT = 'max-h-[420px] xl:max-h-[480px]'

export function DashboardRecognitionQueue({ rows, action }: DashboardRecognitionQueueProps) {
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">To recognize</h3>
          <p className="mt-1 text-xs text-foreground/60">Remaining value per order from the live backlog view.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-foreground/50">{rows.length} shown</span>
          {action}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-foreground/60">
          No pending recognition rows were returned.
        </div>
      ) : (
        <div
          className={`overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-background/70 ${SCROLLABLE_HEIGHT}`}
        >
          <ul className="divide-y divide-border/70">
            {rows.map((row, index) => (
              <li
                key={`${row.encPhc ?? 'missing'}-${row.orderDate ?? index}`}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0 text-sm text-foreground/75">
                  <div className="truncate">
                    <span className="font-medium text-foreground">{row.client ?? 'Unknown client'}</span>
                    {row.encPhc ? <span className="text-foreground/55"> · {row.encPhc}</span> : null}
                  </div>
                  <div className="mt-0.5 text-xs text-foreground/50">
                    {formatOrderDate(row.orderDate)}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-semibold tabular-nums text-warning">
                  {formatPrice(row.remainingValue)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Inline "View all" button sized to sit in the queue card's header. Kept here so the
 * dashboard page stays free of dashboard-internal wiring (state, modal) — the parent
 * just opens/closes the modal in response.
 */
export function DashboardRecognitionQueueViewAllButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="secondary" onClick={onClick}>
      <Maximize2 className="size-3.5" aria-hidden />
      View all
    </Button>
  )
}
