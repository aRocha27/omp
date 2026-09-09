/**
 * Permission helpers.
 *
 * Frontend role checks are UX behaviour only — the future backend must
 * independently authorize every mutation (AGENT.md §5, SECURITY.md §3).
 * Mirrors the effective `Editar`/`Admin` state from `M_Geral`:
 *   Editar = "S" when not read-only;  Admin = "S" when Admin=True.
 */
import type { User } from '@/domain/models/user'

/** True when the user may perform normal business mutations (editor or admin). */
export function canEdit(user: Pick<User, 'Read_Only'>): boolean {
  return !user.Read_Only
}

/** True when the user may access admin maintenance / privileged actions. */
export function canAdmin(user: Pick<User, 'Admin'>): boolean {
  return user.Admin
}

export const canView = (_user: Pick<User, 'Read_Only'>): boolean => true
export const canExport = (_user: Pick<User, 'Read_Only'>): boolean => true
export const canCreate = canEdit
export const canDelete = canEdit
export const canManageUsers = canAdmin

/** Normal order mutations (create/edit) follow the `Editar` flag (AGENT.md §6). */
export function canMutateOrder(user: Pick<User, 'Read_Only'>): boolean {
  return canEdit(user)
}

/** Admin master-data maintenance and Close Deals are admin-only (AGENT.md §7). */
export function canManageAdminData(user: Pick<User, 'Admin'>): boolean {
  return canAdmin(user)
}
