import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleAlert, FolderClock, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingBlock } from '@/components/ui/spinner'
import { useRecognitionQueue } from '@/features/dashboard/api/use-dashboard'
import { RecognitionQueueTable } from '@/features/dashboard/components/recognition-queue-table'

interface ToRecognizeOrdersModalProps {
  open: boolean
  onClose: () => void
}

/**
 * Full-page overlay showing every row from dbo.[11-Reconhecimento-PorReconhecer] —
 * the same source as the dashboard's "To recognize" card, in a sortable grid.
 * Clicking a row navigates to that order's detail page so the user can manage its
 * recognition/invoicing; Esc / X / backdrop close the modal. The queue query is
 * only enabled while open so the modal does not fetch the full backlog until the
 * user actually opens it.
 */
export function ToRecognizeOrdersModal({ open, onClose }: ToRecognizeOrdersModalProps) {
  const navigate = useNavigate()
  const closeRef = useRef<HTMLButtonElement>(null)
  const { data, isPending, isError, error } = useRecognitionQueue(open)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const rows = data ?? []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="to-recognize-modal-title"
        className="flex h-full max-h-[90vh] w-full max-w-[110rem] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2
              id="to-recognize-modal-title"
              className="text-sm font-semibold text-foreground"
            >
              To recognize — full backlog
            </h2>
            <p className="mt-0.5 text-xs text-foreground/60">
              Every order with value still to recognize, from dbo.[11-Reconhecimento-PorReconhecer].
              Click a row to open the order.
            </p>
          </div>
          <Button ref={closeRef} size="sm" variant="secondary" onClick={onClose} aria-label="Close">
            <X className="size-4" aria-hidden />
            Close
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden p-4">
          {isPending ? (
            <LoadingBlock label="Loading backlog…" />
          ) : isError ? (
            <EmptyState
              icon={CircleAlert}
              title="Couldn’t load backlog"
              description={error instanceof Error ? error.message : 'Something went wrong.'}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={FolderClock}
              title="Nothing to recognize"
              description="Every order is fully recognized."
            />
          ) : (
            <RecognitionQueueTable
              data={rows}
              onRowClick={(id) => {
                onClose()
                navigate(`/orders/${id}`)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
