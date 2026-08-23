import { LoaderCircle } from 'lucide-react'
import { cn } from '@/components/ui/cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle className={cn('size-4 animate-spin text-foreground/60', className)} aria-hidden />
  )
}

/** Centered full-area loading indicator with an accessible label. */
export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-foreground/60">
      <Spinner className="size-6" />
      <span className="text-sm">{label}</span>
    </div>
  )
}