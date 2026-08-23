import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/components/ui/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary/90 focus-visible:ring-primary/40',
  secondary:
    'border border-border bg-surface text-foreground hover:bg-foreground/5 focus-visible:ring-foreground/20',
  ghost: 'text-foreground/80 hover:bg-foreground/5 focus-visible:ring-foreground/20',
  danger: 'bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger/40',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
})