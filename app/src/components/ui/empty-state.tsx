import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <Icon className="size-8 text-foreground/30" aria-hidden />
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="mt-1 text-sm text-foreground/60">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}