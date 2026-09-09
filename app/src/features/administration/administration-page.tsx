import { useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { ConnectionManager } from '@/features/administration/components/connection-manager'
import { MasterDataMaintenance } from '@/features/administration/components/master-data-maintenance'
import { CompanySettings } from '@/features/administration/components/company-settings'
import { EmlFilesSettings } from '@/features/administration/components/eml-files-settings'
import type { ConnectionSource } from '@/features/administration/api/admin-api'

export function AdministrationPage() {
  const [databaseSource, setDatabaseSource] = useState<ConnectionSource | null>(null)
  return (
    <div>
      <PageHeader
        title="Administration"
        description="Manage the live SQL Server connection and maintain database tables."
      />
       <CompanySettings source={databaseSource} />
      <EmlFilesSettings />
      <details open className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold">Database</summary>
        <div className="mt-3">
           <ConnectionManager onSourceChange={setDatabaseSource} />
        </div>
      </details>
      <section className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Table maintenance</h2>
          <p className="mt-1 text-xs text-foreground/60">
            Inspect and synchronize real tables from the connected database.
          </p>
        </div>
        <MasterDataMaintenance source={databaseSource} />
      </section>
    </div>
  )
}
