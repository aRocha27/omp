import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Role, RoleLike, User } from '@/domain/models/user'
import { deriveRole } from '@/domain/models/user'

/**
 * Deterministic role/user simulator (development only).
 *
 * Replaces Windows/VBA identity acquisition with a switchable mock user so
 * Viewer/Editor/Admin UX can be exercised. This is NOT authentication — the
 * future backend must independently authorize every mutation (SECURITY.md §2-3).
 * See docs/context/MOCK_DATA_CONTRACT.md §3 (Users).
 */

const mockUsers: Record<Role, User> = {
  user: {
    ID_User: 1,
    User_Name: 'Demo User',
    role: 'user',
    Read_Only: false,
    Admin: false,
  },
  viewer: { ID_User: 4, User_Name: 'Legacy Viewer', role: 'viewer', Read_Only: true, Admin: false },
  editor: { ID_User: 5, User_Name: 'Legacy Editor', role: 'editor', Read_Only: false, Admin: false },
  admin: {
    ID_User: 3,
    User_Name: 'Demo Admin',
    role: 'admin',
    Read_Only: false,
    Admin: true,
  },
}

export const roles: Role[] = ['user', 'admin']

interface UserContextValue {
  user: User
  setRole: (role: Role) => void
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children, initialRole = 'user' }: { children: ReactNode; initialRole?: RoleLike }) {
  const [role, setRole] = useState<Role>(initialRole)
  const value = useMemo<UserContextValue>(() => {
    const user = mockUsers[role]
    return { user, setRole: (next) => setRole(next === 'admin' || next === 'user' || next === 'editor' || next === 'viewer' ? next : 'viewer') }
  }, [role])
  return <UserContext value={value}>{children}</UserContext>
}

export function useCurrentUser(): User {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useCurrentUser must be used within <UserProvider>')
  return ctx.user
}

export function useRoleSwitcher(): { role: Role; setRole: (r: Role) => void; roles: Role[] } {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useRoleSwitcher must be used within <UserProvider>')
  return { role: ctx.user.role as Role, setRole: ctx.setRole, roles }
}

/** Re-export for convenience in components that derive roles. */
export { deriveRole }
