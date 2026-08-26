import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

/**
 * In-app confirmation dialog.
 *
 * Replaces the native `window.confirm` (which exposes the browser's
 * "Prevent this page from creating additional dialogs" checkbox — a
 * persistent "lifetime" suppression of future confirmations). This dialog
 * asks fresh every time and intentionally offers no "remember my choice"
 * toggle.
 */
export interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Autofocus the dismissive control on open so the first Tab lands inside
  // the dialog; Escape dismisses without committing.
  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-4 shadow-lg"
      >
        <h2
          id="confirm-dialog-title"
          className="text-sm font-semibold text-foreground"
        >
          {title}
        </h2>
        <div className="mt-2 text-xs text-foreground/70">{description}</div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            ref={cancelRef}
            size="sm"
            variant="secondary"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}