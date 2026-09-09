import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/app/providers/user-provider'

const tones = {
  primary: {
    chip: 'bg-primary/15 text-primary',
    ring: 'ring-primary/10',
  },
  success: {
    chip: 'bg-success/15 text-success',
    ring: 'ring-success/10',
  },
  warning: {
    chip: 'bg-warning/15 text-warning',
    ring: 'ring-warning/10',
  },
  violet: {
    chip: 'bg-violet/15 text-violet',
    ring: 'ring-violet/10',
  },
} as const

interface DashboardMetricCardProps {
  label: string
  value: string
  meta: string
  icon: LucideIcon
  tone: keyof typeof tones
}

export function DashboardMetricCard({
  label,
  value,
  meta,
  icon: Icon,
  tone,
}: DashboardMetricCardProps) {
  const palette = tones[tone]
  const { user } = useAuth()

  return (
    <article className={`rounded-lg border border-border bg-surface p-4 shadow-sm ring-1 ${palette.ring}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/55">{label}</p>
          <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
          {user?.Admin && <p className="mt-2 text-xs text-foreground/60">{meta}</p>}
        </div>
        <div className={`rounded-full p-2 ${palette.chip}`}>
          <Icon className="size-4" aria-hidden />
        </div>
      </div>
    </article>
  )
}
