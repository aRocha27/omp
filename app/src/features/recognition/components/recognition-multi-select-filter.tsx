import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/components/ui/cn'

/**
 * Toggle a list of checkboxes from a single dropdown trigger.
 *
 * Generic building block shared by every filter on the Recognition page so
 * the visual + keyboard contract is identical: a button shows the current
 * selection count, the popover lists every option, the popover closes on
 * outside click / Escape, and the button is keyboard-reachable.
 */
interface MultiSelectFilterProps<T extends string | number> {
  label: string
  options: readonly T[]
  selected: readonly T[]
  onChange: (next: T[]) => void
  /** Optional label resolver; defaults to String(option). */
  formatOption?: (option: T) => string
  /** Optional placeholder shown when the list is empty. */
  emptyLabel?: string
}

export function MultiSelectFilter<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  formatOption = (option) => String(option),
  emptyLabel = 'No values',
}: MultiSelectFilterProps<T>) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonId = useId()
  const panelId = useId()
  const active = selected.length > 0

  function toggle(option: T) {
    if (selected.includes(option)) {
      onChange(selected.filter((value) => value !== option))
    } else {
      onChange([...selected, option])
    }
  }

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={buttonId}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          active
            ? 'border-primary/60 bg-primary/10 text-primary'
            : 'border-border bg-surface text-foreground hover:bg-foreground/5',
        )}
      >
        <span>{label}</span>
        {active && (
          <span
            aria-hidden
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white"
          >
            {selected.length}
          </span>
        )}
        <ChevronDown
          className={cn('size-3.5 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-labelledby={buttonId}
          className="absolute left-0 z-20 mt-1 min-w-56 max-h-72 overflow-y-auto rounded-md border border-border bg-surface p-2 shadow-lg"
        >
          {options.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-foreground/50">{emptyLabel}</p>
          ) : (
            options.map((option) => {
              const checked = selected.includes(option)
              return (
                <label
                  key={String(option)}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-foreground/5"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(option)}
                    aria-label={`${label} ${formatOption(option)}`}
                    className="size-4 rounded border-border text-primary focus:ring-primary/40"
                  />
                  <span className="truncate">{formatOption(option)}</span>
                </label>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

/** Render a stack of selected pills with × buttons for quick removal. */
export function ActiveFilterChips<T extends string | number>({
  label,
  selected,
  onRemove,
  formatOption = (option) => String(option),
  onClear,
}: {
  label: string
  selected: readonly T[]
  onRemove: (value: T) => void
  formatOption?: (value: T) => string
  onClear?: () => void
}): ReactNode {
  if (selected.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-foreground/70">
      <span className="font-medium uppercase tracking-wide text-foreground/50">
        {label}
      </span>
      {selected.map((value) => (
        <span
          key={String(value)}
          className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary"
        >
          {formatOption(value)}
          <button
            type="button"
            aria-label={`Remove filter ${formatOption(value)}`}
            onClick={() => onRemove(value)}
            className="inline-flex size-4 items-center justify-center rounded-full text-primary hover:bg-primary/20"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      {onClear && selected.length > 1 && (
        <button
          type="button"
          onClick={onClear}
          className="ml-1 text-foreground/60 hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  )
}
