import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useCurrentUser } from '@/app/providers/user-provider'
import { canAdmin } from '@/domain/permissions'

/** UX gate only; the Node API still requires real server-side authorization before production. */
export function AdminRoute({ children }: { children: ReactNode }) {
  const user = useCurrentUser()
  return canAdmin(user) ? children : <Navigate to="/" replace />
}
