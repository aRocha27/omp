import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { env } from '@/app/configuration/env'
import type { Role, RoleLike, User } from '@/domain/models/user'
import { deriveRole } from '@/domain/models/user'

const mockUsers: Record<Role, User> = {
  user: { ID_User: 1, User_Name: 'Demo User', role: 'user', Read_Only: false, Admin: false },
  viewer: { ID_User: 4, User_Name: 'Legacy Viewer', role: 'viewer', Read_Only: true, Admin: false },
  editor: { ID_User: 5, User_Name: 'Legacy Editor', role: 'editor', Read_Only: false, Admin: false },
  admin: { ID_User: 3, User_Name: 'Demo Admin', role: 'admin', Read_Only: false, Admin: true },
}
export const roles: Role[] = ['user', 'admin']
interface UserContextValue { user: User | null; accountIsAdmin: boolean; loading: boolean; login: (username: string, password?: string) => Promise<{ firstLogin: boolean }>; completeFirstLogin: (username: string, password: string, confirmation: string) => Promise<void>; changePassword: (currentPassword: string, password: string, confirmation: string) => Promise<void>; logout: () => Promise<void>; setRole?: (role: Role) => void }
const UserContext = createContext<UserContextValue | null>(null)
export const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000
function mapUser(next: { id: string; username: string; role: string }): User { const admin = next.role === 'ADMIN'; const reader = next.role === 'READER'; return { ID_User: Number(next.id) || 0, User_Name: next.username, role: admin ? 'admin' : reader ? 'viewer' : 'editor', Read_Only: reader, Admin: admin } }

export function UserProvider({ children, initialRole = 'user' }: { children: ReactNode; initialRole?: RoleLike }) {
  const testMode = import.meta.env.MODE === 'test'; const [viewRole, setViewRole] = useState<Role>(initialRole); const [account, setAccount] = useState<User | null>(testMode ? mockUsers[initialRole] : null); const [loading, setLoading] = useState(!testMode)
  useEffect(() => { if (testMode) return; void fetch(`${env.apiBaseUrl}/auth/me`, { credentials: 'include' }).then((r) => r.ok ? r.json() : null).then((body) => { if (body?.user) { const next = mapUser(body.user); setAccount(next); setViewRole(next.Admin ? 'user' : next.role) } }).finally(() => setLoading(false)) }, [testMode])
  const value = useMemo<UserContextValue>(() => { const request = async (path: string, body: unknown) => { const response = await fetch(`${env.apiBaseUrl}${path}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message ?? 'Request failed'); return data }; const displayed = testMode ? mockUsers[viewRole] : account?.Admin && viewRole === 'user' ? { ...account, Admin: false, Read_Only: false, role: 'user' as const } : account; return { user: displayed, accountIsAdmin: Boolean(account?.Admin) || testMode && Boolean(mockUsers[viewRole].Admin), loading, login: async (username, password = '') => { try { sessionStorage.removeItem('orders-welcome-shown') } catch { void 0 }; const data = await request('/auth/login', { username, password }); if (data.user) { const next = mapUser(data.user); setAccount(next); setViewRole(next.Admin ? 'user' : next.role) } return { firstLogin: Boolean(data.firstLogin) } }, completeFirstLogin: async (username, password, confirmation) => { const data = await request('/auth/first-password', { username, password, confirmation }); const next = mapUser(data.user); setAccount(next); setViewRole(next.Admin ? 'user' : next.role) }, changePassword: async (currentPassword, password, confirmation) => { await request('/auth/change-password', { currentPassword, password, confirmation }) }, logout: async () => { await request('/auth/logout', {}); setAccount(null) }, setRole: (next) => setViewRole(next) } }, [account, loading, testMode, viewRole])
  const { logout } = value
  useEffect(() => {
    if (!account || testMode) return
    let timer = window.setTimeout(() => { void logout().catch(() => setAccount(null)) }, INACTIVITY_TIMEOUT_MS)
    const resetTimer = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => { void logout().catch(() => setAccount(null)) }, INACTIVITY_TIMEOUT_MS)
    }
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'] as const
    activityEvents.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }))
    return () => {
      window.clearTimeout(timer)
      activityEvents.forEach((event) => window.removeEventListener(event, resetTimer))
    }
  }, [account, logout, testMode])
  return <UserContext value={value}>{children}</UserContext>
}
export function useAuth() { const context = useContext(UserContext); if (!context) throw new Error('useAuth must be used within <UserProvider>'); return context }
export function useCurrentUser(): User { const user = useAuth().user; if (!user) throw new Error('No authenticated user'); return user }
export function useRoleSwitcher(): { role: Role; setRole: (role: Role) => void; roles: Role[]; isAdminAccount: boolean } { const context = useAuth(); return { role: context.user?.role as Role, setRole: context.setRole!, roles, isAdminAccount: context.accountIsAdmin } }
export { deriveRole }
