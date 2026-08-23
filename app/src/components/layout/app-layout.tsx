import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/sidebar'
import { RoleSwitcher } from '@/components/layout/role-switcher'
import { env } from '@/app/configuration/env'

/**
 * Application chrome: fixed sidebar + top bar with a development role switcher.
 *
 * The role switcher exists only to exercise Viewer/Editor/Admin UX against the
 * mock repository; it is not authentication (SECURITY.md §2-3). The future
 * backend must independently authorize every mutation.
 */
export function AppLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="text-sm font-medium text-foreground/80">Orders Management</div>
          <div className="flex items-center gap-3">
            {env.isMock && (
              <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-[11px] font-semibold text-warning">
                Synthetic data
              </span>
            )}
            <RoleSwitcher />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}