import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/components/ui/cn'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          'disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    )
  },
)