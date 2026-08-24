import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/components/ui/cn'

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Checkbox({ className, type, ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type ?? 'checkbox'}
        className={cn(
          'size-4 shrink-0 rounded border border-border bg-surface text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          'disabled:opacity-50',
          className,
        )}
        {...props}
      />
    )
  },
)