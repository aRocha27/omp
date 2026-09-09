import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/sidebar'
import { RoleSwitcher } from '@/components/layout/role-switcher'
import { useRoleSwitcher } from '@/app/providers/user-provider'
import { env } from '@/app/configuration/env'

/**
 * Application chrome: fixed sidebar + top bar with a development role switcher.
 *
 * The role switcher exists only to exercise Viewer/Editor/Admin UX against the
 * mock repository; it is not authentication (SECURITY.md §2-3). The future
 * backend must independently authorize every mutation.
 */
export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isAdminAccount } = useRoleSwitcher()

  return (
    <div className="flex min-h-[100dvh] h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/35 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#082844] bg-[#082844] px-3 text-white sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
              className="rounded-md p-2 text-white/90 hover:bg-white/10 md:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? (
                <X className="size-5" aria-hidden />
              ) : (
                <Menu className="size-5" aria-hidden />
              )}
            </button>
            <div className="truncate text-sm font-semibold tracking-wide text-white">
               Paperfold Stationery Platform
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {env.isMock && (
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                Synthetic data
              </span>
            )}
            {isAdminAccount && <RoleSwitcher />}
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
