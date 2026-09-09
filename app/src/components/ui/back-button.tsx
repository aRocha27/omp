import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

interface BackButtonProps {
  /** Path to navigate to (defaults to `/orders`). */
  to?: string
}

/**
 * Shared "Back" button used by detail pages. The previous implementation
 * lived inline in both `order-detail-page.tsx` and `client-detail-page.tsx`
 * with the only difference being the navigate path. The optional `to` prop
 * lets each page point to its own list route without a copy-paste.
 */
export function BackButton({ to = '/orders' }: BackButtonProps) {
  const navigate = useNavigate()
  return (
    <Button variant="ghost" size="sm" onClick={() => navigate(to)}>
      <ArrowLeft className="size-4" aria-hidden />
      Back
    </Button>
  )
}