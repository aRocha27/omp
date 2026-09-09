import { CircleAlert } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { BackButton } from '@/components/ui/back-button'

interface NotFoundStateProps {
  description: string
  /** Title shown to the user; defaults to "Not found". */
  title?: string
  /** Back-button path; defaults to `/orders`. */
  backTo?: string
}

/**
 * Standard "row not found" presentation used by detail pages when the
 * entity either 404s, has an invalid id, or is still loading and ends
 * up empty. Wraps `<EmptyState>` with a Back action so the user always
 * has an exit. Title and back target are configurable per feature.
 */
export function NotFoundState({
  description,
  title = 'Not found',
  backTo = '/orders',
}: NotFoundStateProps) {
  return (
    <EmptyState
      icon={CircleAlert}
      title={title}
      description={description}
      action={<BackButton to={backTo} />}
    />
  )
}