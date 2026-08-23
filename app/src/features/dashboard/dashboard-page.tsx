import { PageHeader } from '@/components/ui/page-header'
import { env } from '@/app/configuration/env'

/** Dashboard placeholder. Real KPIs land once the Recognition/Invoicing features ship. */
export function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of orders, revenue and stock." />
      <div className="rounded-lg border border-dashed border-border p-8 text-sm text-foreground/60">
        KPI cards and charts will be implemented as their backing features land.
        {env.isMock && ' (Currently showing synthetic data.)'}
      </div>
    </div>
  )
}