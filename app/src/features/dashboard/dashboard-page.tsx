import { useState } from 'react'
import { BarChart3, ClipboardList, Euro, FolderClock, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingBlock } from '@/components/ui/spinner'
import { useCurrentUser } from '@/app/providers/user-provider'
import { canEdit } from '@/domain/permissions'
import { useDashboard } from '@/features/dashboard/api/use-dashboard'
import { DashboardMetricCard } from '@/features/dashboard/components/dashboard-metric-card'
import {
  DashboardRecognitionQueue,
  DashboardRecognitionQueueViewAllButton,
} from '@/features/dashboard/components/dashboard-recognition-queue'
import { DashboardRecentOrdersTable } from '@/features/dashboard/components/dashboard-recent-orders-table'
import { DashboardTrendChart } from '@/features/dashboard/components/dashboard-trend-chart'
import { ToRecognizeOrdersModal } from '@/features/dashboard/components/to-recognize-orders-modal'
import { formatPrice } from '@/utils/format'

export function DashboardPage() {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const { data, isPending, isError, error } = useDashboard()
  const [showAllOrders, setShowAllOrders] = useState(false)

  const actions = (
    <>
      <Button size="sm" variant="secondary" onClick={() => navigate('/orders')}>
        <ClipboardList className="size-4" aria-hidden />
        Open orders
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

      <section className="mt-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
        <DashboardRecentOrdersTable rows={data.recentOrders} />
      </section>

      <ToRecognizeOrdersModal open={showAllOrders} onClose={() => setShowAllOrders(false)} />
    </div>
  )
}
