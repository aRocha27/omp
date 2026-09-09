import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/components/ui/cn'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type, ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type ?? 'text'}
        className={cn(
          'h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground',
          'placeholder:text-foreground/40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          'disabled:opacity-50',
          className,
        )}
        {...props}
      />
    )
  },
)