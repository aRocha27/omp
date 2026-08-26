import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/components/ui/cn'
import { formatIsoToDisplay, parseDisplayToIso } from '@/utils/date-picker'

/**
 * Date input that always displays `dd/mm/yyyy` regardless of the OS locale.
 *
 * Earlier this was a thin wrapper around the native `<input type="date">`, but
 * the browser formats the value with `navigator.language` — so on a workstation
 * set to en-US the user saw `mm/dd/yyyy` even though every read-only date in
 * the app renders as `dd/mm/yyyy` (pt-PT). That mismatch is confusing, and
 * `dd/mm/yyyy` is the business locale for this app (TIMEZONE.md / AGENT.md).
 *
 * Trade-off vs the native picker: a plain text input has no calendar UI. The
 * app is a desktop tool used by a small team, so the calendar widget was nice-
 * to-have, not load-bearing — and consistency with the read-only `dd/mm/yyyy`
 * displays everywhere else wins.
 *
 * Wire contract (unchanged from the native-picker version):
 *   value:    ISO `YYYY-MM-DD` | `null`   — what the parent stores
 *   onChange: (next: string | null) => void
 *
 * Behavior:
 *  - Display layer always shows the ISO as `dd/mm/yyyy` (via `formatIsoToDisplay`).
 *  - The user types digits; we only commit to `onChange` once the typed value
 *    parses to a real calendar date. Clearing the field commits `null`.
 *  - Partial / invalid keystrokes (e.g. `1`, `1/`, `1/2`, `99/99/2026`) keep the
 *    text on screen so the user can finish typing, but no onChange fires —
 *    `parseDisplayToIso` returns `undefined` for those.
 */
export interface DatePickerProps {
  value: string | null
  onChange: (next: string | null) => void
  'aria-label': string
  disabled?: boolean
  /** Optional id for the wrapper (mostly for tests). */
  id?: string
  /** Optional className for the wrapping div. */
  className?: string
  /** Optional placeholder shown when the field is empty. */
  placeholder?: string
}

export function DatePicker({
  value,
  onChange,
  disabled,
  id,
  className,
  placeholder = 'dd/mm/aaaa',
  ...rest
}: DatePickerProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const ariaLabel = rest['aria-label']
  const nativeInputRef = useRef<HTMLInputElement>(null)

  // Local text state so partial keystrokes don't round-trip through onChange.
  // The effect mirrors the parent `value` into local text — only when the
  // *parent* value moves. User typing keeps `value` constant so the effect
  // skips. This is the canonical "controlled input with internal echo state"
  // pattern; the React-hooks lint flags it but the alternative (passing the
  // value down as a `key` so a remount resets the text) loses focus mid-edit.
  const displayFromValue = value == null ? '' : formatIsoToDisplay(value)
  const [text, setText] = useState<string>(displayFromValue)
  useEffect(() => {
    setText(displayFromValue)
  }, [displayFromValue])

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value
    setText(next)
    const parsed = parseDisplayToIso(next)
    if (parsed === undefined) return // still typing — wait for a real date
    onChange(parsed) // null when cleared, ISO when a valid dd/mm/yyyy was typed
  }

  function handleNativePickerChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value
    if (next === '') {
      setText('')
      onChange(null)
      return
    }
    setText(formatIsoToDisplay(next))
    onChange(next)
  }

  function openCalendar() {
    if (disabled) return
    const input = nativeInputRef.current
    if (!input) return
    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }
    // Browser fallback when `showPicker()` is unavailable.
    input.focus()
    input.click()
  }

  return (
    <div className={cn('relative flex items-center gap-2', className)}>
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={text}
        disabled={disabled}
        onChange={handleChange}
        className={cn(
          'h-9 w-full rounded-md border border-border bg-surface px-3 pr-10 text-sm text-foreground',
          'placeholder:text-foreground/40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          'disabled:opacity-50',
        )}
      />
      <button
        type="button"
        aria-label={`Open calendar for ${ariaLabel}`}
        onClick={openCalendar}
        disabled={disabled}
        className={cn(
          'absolute right-2 inline-flex size-6 items-center justify-center rounded text-foreground/50',
          'hover:bg-foreground/5 hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <CalendarDays className="size-4" aria-hidden />
      </button>
      <input
        ref={nativeInputRef}
        tabIndex={-1}
        aria-hidden="true"
        lang="pt-PT"
        type="date"
        value={value ?? ''}
        disabled={disabled}
        onChange={handleNativePickerChange}
        className="absolute -z-10 h-px w-px overflow-hidden opacity-0"
      />
    </div>
  )
}
