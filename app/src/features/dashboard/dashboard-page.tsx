import { useRef, useState, useEffect, type MutableRefObject } from 'react'
import {
  BarChart3,
  ClipboardList,
  Euro,
  FolderClock,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingBlock } from '@/components/ui/spinner'
import { useAuth, useCurrentUser } from '@/app/providers/user-provider'
import { canEdit } from '@/domain/permissions'
import { useDashboard } from '@/features/dashboard/api/use-dashboard'
import { DashboardMetricCard } from '@/features/dashboard/components/dashboard-metric-card'
import {
  DashboardRecognitionQueue,
  DashboardRecognitionQueueViewAllButton,
} from '@/features/dashboard/components/dashboard-recognition-queue'
import { DashboardTrendChart } from '@/features/dashboard/components/dashboard-trend-chart'
import { ToRecognizeOrdersModal } from '@/features/dashboard/components/to-recognize-orders-modal'
import { formatOrderDate, formatPrice } from '@/utils/format'

export function DashboardPage() {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const { user: displayedUser } = useAuth()
  const { data, isPending, isError, error, isFetching, refetch } = useDashboard()
  const [showAllOrders, setShowAllOrders] = useState(false)
  const [queueWidths, setQueueWidths] = useState([33.33, 33.34, 33.33])
  const queueGridRef = useRef<HTMLDivElement>(null)
  const resizeStartRef = useRef<{ x: number; splitter: 0 | 1; left: number; right: number } | null>(
    null,
  )

  useEffect(() => {
    function resize(event: PointerEvent) {
      const resizeStart = resizeStartRef.current
      if (!resizeStart) return
      const width = queueGridRef.current?.getBoundingClientRect().width ?? 0
      if (width <= 0) return
      const delta = ((event.clientX - resizeStart.x) / width) * 100
      const left = Math.max(8, Math.min(84, resizeStart.left + delta))
      const right = Math.max(8, Math.min(84, resizeStart.right - delta))
      if (left + right > 92) return
      setQueueWidths((current) => {
        const next = [...current]
        next[resizeStart.splitter] = left
        next[resizeStart.splitter + 1] = right
        return next
      })
    }
    const stopResize = () => {
      resizeStartRef.current = null
    }
    window.addEventListener('pointermove', resize)
    window.addEventListener('pointerup', stopResize)
    return () => {
      window.removeEventListener('pointermove', resize)
      window.removeEventListener('pointerup', stopResize)
    }
  }, [])

  const actions = (
    <>
      <Button size="sm" variant="secondary" onClick={() => navigate('/orders')}>
        <ClipboardList className="size-4" aria-hidden />
        Open orders
      </Button>
      <Button size="sm" variant="secondary" onClick={() => navigate('/invoicing')}>
        <Euro className="size-4" aria-hidden />
        Invoice/Warranty
      </Button>
      <Button size="sm" variant="secondary" onClick={() => refetch()} disabled={isFetching}>
        <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} aria-hidden />
        Refresh
      </Button>
      {canEdit(user) && (
        <Button size="sm" onClick={() => navigate('/orders/new')}>
          <Plus className="size-4" aria-hidden />
          New order
        </Button>
      )}
    </>
  )

  if (isPending) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          description="Operational overview over the linked database."
          actions={actions}
        />
        <LoadingBlock label="Loading dashboard…" />
      </div>
    )
  }

  if (isError) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          description="Operational overview over the linked database."
          actions={actions}
        />
        <EmptyState
          icon={BarChart3}
          title="Couldn’t load dashboard"
          description={error instanceof Error ? error.message : 'Something went wrong.'}
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          description="Operational overview over the linked database."
          actions={actions}
        />
        <EmptyState
          icon={FolderClock}
          title="No dashboard data"
          description="The dashboard returned no snapshot rows."
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Current-year dashboard for ${data.year}, backed by the live database.`}
        actions={actions}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardMetricCard
          label="Backlog at period start"
          value={formatPrice(data.kpis.backlogAtPeriodStart)}
          meta={`Client orders before 01/01/${data.year} less recognized value before 01/01/${data.year}.`}
          icon={FolderClock}
          tone="warning"
        />
        <DashboardMetricCard
          label="NOB YTD"
          value={formatPrice(data.kpis.nobYtd)}
          meta="New Order Booking from Sell Price."
          icon={BarChart3}
          tone="violet"
        />
        <DashboardMetricCard
          label="Revenue recognized YTD"
          value={formatPrice(data.kpis.revenueRecognizedYtd)}
          meta="Current-year recognized revenue."
          icon={Euro}
          tone="success"
        />
        <DashboardMetricCard
          label="Backlog to recognize"
          value={formatPrice(data.kpis.backlogToRecognize)}
          meta="Opening backlog plus current-year NOB less current-year recognized revenue."
          icon={FolderClock}
          tone="warning"
        />
        <DashboardMetricCard
          label="Orders booked YTD"
          value={String(data.kpis.ordersBookedYtd)}
          meta={`Count of orders opened in ${data.year}.`}
          icon={ClipboardList}
          tone="primary"
        />
      </section>

      <section className="mt-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-foreground">Order type queues</h3>
          <p className="mt-1 text-xs text-foreground/60">
            Orders waiting for customer PO or SAP entry.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <OrderTypeQueue
            title="Waiting PO"
            rows={data.waitingPoOrders ?? []}
            total={data.waitingPoOrdersTotal ?? (data.waitingPoOrders ?? []).length}
            onOpen={(id) => navigate(`/orders/${id}`, { state: { from: '/' } })}
          />
          <OrderTypeQueue
            title="Insert SAP"
            rows={data.introduzirSapOrders ?? []}
            total={data.introduzirSapOrdersTotal ?? (data.introduzirSapOrders ?? []).length}
            onOpen={(id) => navigate(`/orders/${id}`, { state: { from: '/' } })}
          />
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <DashboardTrendChart points={data.monthlyTrend} />
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
          <DashboardRecognitionQueue
            rows={data.recognitionQueue}
            action={
              <DashboardRecognitionQueueViewAllButton onClick={() => setShowAllOrders(true)} />
            }
          />
        </div>
      </section>

      <section className="relative mt-4 pb-1">
        <div
          ref={queueGridRef}
          className="grid w-full items-stretch"
          style={{
            gridTemplateColumns: `${queueWidths[0]}fr 6px ${queueWidths[1]}fr 6px ${queueWidths[2]}fr`,
          }}
        >
          <div className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Warranty start missing</h3>
                 {displayedUser?.Admin && (
                   <p className="mt-1 text-xs text-foreground/60">
                     Top 10 rows from `dbo.V_Orders_Warranty_Sem_Data`.
                   </p>
                 )}
              </div>
              <DashboardShowingCount
                sample={data.warrantyMissing.length}
                total={data.warrantyMissingTotal}
              />
            </div>
            {data.warrantyMissing.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm text-foreground/60">
                No orders without warranty start were returned.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-b border-border text-left text-[11px] uppercase tracking-wider text-foreground/60">
                    <tr>
                      <th className="px-3 py-2">Order</th>
                      <th className="px-3 py-2">Encomenda PHC</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Warranty Start</th>
                      <th className="px-3 py-2 text-right">Sell Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.warrantyMissing.map((row) => (
                      <tr
                        key={`${row.idOrder}-${row.encomendaCliPHC ?? ''}`}
                        className="border-b border-border/40"
                      >
                        <td className="px-3 py-2">
                          <Link
                            to={`/orders/${row.idOrder}`}
                            aria-label={`View order ${row.idOrder} details`}
                            className="font-medium hover:underline"
                          >
                            {row.idOrder}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{row.encomendaCliPHC ?? '—'}</td>
                        <td className="px-3 py-2">{row.idTipo ?? '—'}</td>
                        <td className="px-3 py-2">{formatOrderDate(row.warrantyDtInicio)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatPrice(row.sellPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DashboardColumnSplitter
            label="Resize warranty and invoice tables horizontally"
            splitter={0}
            widths={queueWidths}
            resizeStartRef={resizeStartRef}
          />

          <div className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Amount to invoice</h3>
                 {displayedUser?.Admin && (
                   <p className="mt-1 text-xs text-foreground/60">
                     Top rows from `dbo.V_Orders_Nao_Faturadas_Totalmente`.
                   </p>
                 )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-1.5 text-right">
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-foreground/55">
                    Total to invoice
                  </span>
                  <strong className="block text-sm tabular-nums text-foreground">
                    {formatPrice(data.kpis.amountToInvoice)}
                  </strong>
                </div>
                <DashboardShowingCount
                  sample={data.notFullyInvoiced.length}
                  total={data.notFullyInvoicedTotal}
                />
              </div>
            </div>
            {data.notFullyInvoiced.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm text-foreground/60">
                No rows pending invoicing were returned.
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b border-border text-left text-[11px] uppercase tracking-wider text-foreground/60">
                    <tr>
                      <th className="px-3 py-2">Order</th>
                      <th className="px-3 py-2">Encomenda PHC</th>
                      <th className="px-3 py-2 text-right">Sell Price</th>
                      <th className="px-3 py-2 text-right">Total Invoiced</th>
                      <th className="px-3 py-2 text-right">Diferenca</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.notFullyInvoiced.map((row) => (
                      <tr
                        key={`${row.idOrder}-${row.encomendaCliPHC ?? ''}`}
                        className="border-b border-border/40"
                      >
                        <td className="px-3 py-2">{row.idOrder}</td>
                        <td className="px-3 py-2">{row.encomendaCliPHC ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatPrice(row.sellPrice)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatPrice(row.totalFaturado)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-warning">
                          {formatPrice(row.diferenca)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DashboardColumnSplitter
            label="Resize invoice and recognition tables horizontally"
            splitter={1}
            widths={queueWidths}
            resizeStartRef={resizeStartRef}
          />
          <div className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Pending recognition</h3>
                 {displayedUser?.Admin && (
                   <p className="mt-1 text-xs text-foreground/60">
                     Rows from `dbo.V_Orders_Reconhecimento_Pendente`.
                   </p>
                 )}
              </div>
              <PendingRecognitionCount
                sample={(data.pendingRecognition ?? []).length}
                total={data.pendingRecognitionTotal}
              />
            </div>
            {(data.pendingRecognition ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm text-foreground/60">
                No pending recognition rows were returned.
              </div>
            ) : (
              <div className="max-h-[420px] overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="border-b border-border text-left text-[11px] uppercase tracking-wider text-foreground/60">
                    <tr>
                      <th className="px-3 py-2">Client</th>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2 text-right">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.pendingRecognition ?? []).map((row, index) => (
                      <tr
                        key={`${row.encomendaCliPHC ?? 'missing'}-${index}`}
                        className="border-b border-border/40"
                      >
                        <td className="px-3 py-2">{row.client ?? '—'}</td>
                        <td className="px-3 py-2">{row.product ?? row.type ?? '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-warning">
                          {formatPrice(row.difference)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      <ToRecognizeOrdersModal open={showAllOrders} onClose={() => setShowAllOrders(false)} />
    </div>
  )
}

function DashboardColumnSplitter({
  label,
  splitter,
  widths,
  resizeStartRef,
}: {
  label: string
  splitter: 0 | 1
  widths: number[]
  resizeStartRef: MutableRefObject<{ x: number; splitter: 0 | 1; left: number; right: number } | null>
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="z-10 min-h-16 cursor-col-resize bg-border/60 hover:bg-primary"
      onPointerDown={(event) => {
        resizeStartRef.current = {
          x: event.clientX,
          splitter,
          left: widths[splitter],
          right: widths[splitter + 1],
        }
      }}
    />
  )
}

function OrderTypeQueue({
  title,
  rows,
  total,
  onOpen,
}: {
  title: string
  rows: Array<{ idOrder: number; encomendaCliPHC: string | null; client: string | null }>
  /** Total row count for the same source the `rows` sample was drawn from.
   * When the sample is capped (TOP N), `total > rows.length` and the UI
   * renders "showing N out of total". */
  total: number
  onOpen: (id: number) => void
}) {
  // The pill count shows "showing N" (rows in the current sample) and a
  // faint "/ total" when the sample is smaller than the universe — same
  // contract as the pending-recognition card to keep the dashboard
  // visually consistent.
  const truncated = total > rows.length && rows.length > 0
  return (
    <div className="overflow-x-hidden rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border bg-surface-muted px-3 py-2">
        <strong className="text-xs text-foreground">{title}</strong>
        <span
          className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-foreground/60"
          aria-label={truncated ? `Showing ${rows.length} out of ${total}` : `${total} total`}
        >
          {truncated ? `${rows.length}/${total}` : `${total}`}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-xs text-foreground/50">No orders.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {rows.map((row) => (
            <button
              key={row.idOrder}
              type="button"
              onClick={() => onOpen(row.idOrder)}
              className="grid w-full grid-cols-[70px_120px_1fr] gap-2 px-3 py-2 text-left text-xs hover:bg-foreground/5"
            >
              <strong>#{row.idOrder}</strong>
              <span className="truncate text-foreground/60">
                {row.encomendaCliPHC ?? 'No SAP order'}
              </span>
              <span className="truncate">{row.client ?? 'No client name'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * "Showing N out of M" pill for the Pending Recognition card.
 *
 * Mirrors the OrderTypeQueue count pill — when the backend caps the
 * pending-recognition rows at TOP 10, the user sees how many more rows
 * exist in the source view. When `total` is unknown (the backend didn't
 * send the count, e.g. an older dashboard payload), the pill falls back
 * to the sample count.
 */
function PendingRecognitionCount({ sample, total }: { sample: number; total?: number }) {
  return <DashboardShowingCount sample={sample} total={total} />
}

function DashboardShowingCount({ sample, total }: { sample: number; total?: number }) {
  const truncated = total !== undefined && total > sample && sample > 0
  const label = truncated
    ? `Showing ${sample} out of ${total}`
    : total !== undefined
      ? `${total} total`
      : `${sample}`
  return (
    <span
      className="shrink-0 rounded-full bg-foreground/10 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground/60"
      aria-label={label}
      title={label}
    >
      {truncated ? `${sample} of ${total}` : label}
    </span>
  )
}
