import { PageHeader } from '@/components/ui/page-header'
import { ConnectionManager } from '@/features/administration/components/connection-manager'
import { ProfileCreator } from '@/features/administration/components/profile-creator'

export function AdministrationPage() {
  return (
    <div>
      <PageHeader
        title="Administration"
        description="Connect SQL Server profiles, inspect available tables, and sync the orders source."
      />
      <ConnectionManager />
      <ProfileCreator />
    </div>
  )
}
