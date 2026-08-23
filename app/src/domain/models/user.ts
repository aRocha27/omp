/**
 * User and permission model.
 *
 * Maps the confirmed legacy `Utilizador` fields (AGENT.md §5) to an
 * application-side user concept. The web app may replace Windows/VBA identity
 * acquisition with an identity provider, but must preserve the effective
 * permission semantics: read-only, editor, administrator.
 */

/** Effective application roles, derived from `Utilizador.Read_Only` / `Admin`. */
export type Role = 'viewer' | 'editor' | 'admin'

/**
 * Application user.
 *
 * Field names preserve legacy identifiers where they carry meaning
 * (`ID_User`, `User_Name`, `Read_Only`, `Admin`).
 */
export interface User {
  ID_User: number
  User_Name: string
  role: Role
  /** Maps to `Utilizador.Read_Only`. */
  Read_Only: boolean
  /** Maps to `Utilizador.Admin`. */
  Admin: boolean
}

/**
 * Derive the effective role from the legacy flags, mirroring `M_Geral`:
 * - Admin=True  → admin
 * - Read_Only   → viewer
 * - otherwise   → editor
 */
export function deriveRole(user: Pick<User, 'Read_Only' | 'Admin'>): Role {
  if (user.Admin) return 'admin'
  if (user.Read_Only) return 'viewer'
  return 'editor'
}