import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Boxes,
  ChartColumn,
  ClipboardList,
  Factory,
  LayoutDashboard,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useAuth, useCurrentUser } from '@/app/providers/user-provider'
import { canAdmin } from '@/domain/permissions'
import { cn } from '@/components/ui/cn'
import { fetchCompanyIdentification, type SyncResult } from '@/features/administration/api/admin-api'

interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** When true the item is only rendered for admins (UX gating — server still enforces). */
  adminOnly?: boolean
}

const primaryNav: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Orders', to: '/orders', icon: ClipboardList },
  { label: 'Clients', to: '/clients', icon: Users },
  { label: 'Invoice/Warranty', to: '/invoicing', icon: Factory },
  { label: 'Recognition', to: '/recognition', icon: TrendingUp },
  { label: 'Stock', to: '/stock', icon: Boxes },
  { label: 'Reports', to: '/reports', icon: ChartColumn },
]

const adminNav: NavItem[] = [
  { label: 'Administration', to: '/admin', icon: Settings, adminOnly: true },
]

export function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean
  onClose?: () => void
}) {
  const user = useCurrentUser()
  const { logout } = useAuth()
  const [company, setCompany] = useState<SyncResult['rows'][number] | null>(null)
  const isAdmin = canAdmin(user)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
       return window.localStorage.getItem('paperfold-orders-theme') === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
       window.localStorage.setItem('paperfold-orders-theme', theme)
    } catch {
      // Theme persistence is a convenience and may be unavailable in private mode.
    }
  }, [theme])

  useEffect(() => {
    let active = true
    void fetchCompanyIdentification()
      .then((result) => { if (active) setCompany(result.rows[0] ?? null) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  return (
    <aside
      className={cn(
        'flex h-full w-60 shrink-0 flex-col border-r border-[#082844] bg-[#082844] text-white',
        mobileOpen
          ? 'fixed inset-y-0 left-0 z-50 shadow-xl md:static md:shadow-none'
          : 'hidden md:flex',
      )}
    >
      <div className="flex h-14 items-center px-4">
        <img
           src="/paperfold-logo.svg"
           alt="Paperfold Stationery"
          className="h-10 w-full object-contain object-left brightness-0 invert"
        />
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-2" aria-label="Primary">
        {primaryNav.map((item) => (
          <NavItemLink key={item.to} item={item} onNavigate={onClose} />
        ))}

        {isAdmin && (
          <>
            <div className="mt-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/60">
              Admin
            </div>
            {adminNav.map((item) => (
              <NavItemLink key={item.to} item={item} onNavigate={onClose} />
            ))}
          </>
        )}
        <NavItemLink item={{ label: 'Settings', to: '/settings', icon: Settings }} onNavigate={onClose} />
      </nav>

      <div className="border-t border-white/20 px-3 py-2 text-xs text-white/80">
        {company && <CompanyInfo company={company} />}
        <div className="mb-2 flex rounded-md border border-white/30 p-0.5" aria-label="Theme">
          <button
            type="button"
            aria-pressed={theme === 'light'}
            aria-label="Light theme"
            onClick={() => setTheme('light')}
            className="flex flex-1 items-center justify-center gap-1 rounded-[5px] px-2 py-1 text-xs font-medium text-white/80 transition-colors hover:text-white aria-pressed:bg-white aria-pressed:text-primary"
          >
            <Sun className="size-3.5" aria-hidden />
            Light
          </button>
          <button
            type="button"
            aria-pressed={theme === 'dark'}
            aria-label="Dark theme"
            onClick={() => setTheme('dark')}
            className="flex flex-1 items-center justify-center gap-1 rounded-[5px] px-2 py-1 text-xs font-medium text-white/80 transition-colors hover:text-white aria-pressed:bg-white aria-pressed:text-primary"
          >
            <Moon className="size-3.5" aria-hidden />
            Dark
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5" aria-hidden />
          <span>
            {user.User_Name} · <span className="capitalize">{user.role}</span>
          </span>
        </div>
        <button type="button" onClick={() => void logout()} className="mt-2 w-full rounded-md border border-white/25 px-3 py-1.5 text-left text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white">
          Logout
        </button>
      </div>
    </aside>
  )
}

function CompanyInfo({ company }: { company: Record<string, unknown> }) {
  return (
    <div className="mb-3 border-b border-white/15 pb-3 text-[11px] leading-relaxed text-white/70">
      <div className="mb-1.5 break-words text-xs font-semibold text-white/95" title={String(company.Nome ?? '')}>{String(company.Nome ?? 'Company')}</div>
      {[company.Morada, company.Localidade, company.Telefone, company.Mail].filter(Boolean).map((value, index) => (
        <div key={`${String(value)}-${index}`} className="break-words" title={String(value)}>{String(value)}</div>
      ))}
    </div>
  )
}

function NavItemLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-white text-primary shadow-sm'
            : 'text-white/80 hover:bg-white/10 hover:text-white',
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {item.label}
    </NavLink>
  )
}
