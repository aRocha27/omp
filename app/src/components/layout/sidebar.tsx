import { NavLink } from 'react-router-dom'
import {
  Boxes,
  ChartColumn,
  ClipboardList,
  Factory,
  LayoutDashboard,
  ReceiptText,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useCurrentUser } from '@/app/providers/user-provider'
import { canAdmin } from '@/domain/permissions'
import { cn } from '@/components/ui/cn'

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
  { label: 'Factory / Invoicing', to: '/invoicing', icon: Factory },
  { label: 'Recognition', to: '/recognition', icon: TrendingUp },
  { label: 'Stock', to: '/stock', icon: Boxes },
  { label: 'Reports', to: '/reports', icon: ChartColumn },
]

const adminNav: NavItem[] = [
  { label: 'Administration', to: '/admin', icon: Settings, adminOnly: true },
]

export function Sidebar() {
  const user = useCurrentUser()
  const isAdmin = canAdmin(user)

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center gap-2 px-4">
        <ReceiptText className="size-5 text-primary" aria-hidden />
        <span className="text-sm font-semibold tracking-wide text-foreground">Orders Platform</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-2" aria-label="Primary">
        {primaryNav.map((item) => (
          <NavItemLink key={item.to} item={item} />
        ))}

        {isAdmin && (
          <>
            <div className="mt-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
              Admin
            </div>
            {adminNav.map((item) => (
              <NavItemLink key={item.to} item={item} />
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-border px-3 py-2 text-xs text-foreground/60">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5" aria-hidden />
          <span>
            {user.User_Name} · <span className="capitalize">{user.role}</span>
          </span>
        </div>
      </div>
    </aside>
  )
}

function NavItemLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground',
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {item.label}
    </NavLink>
  )
}