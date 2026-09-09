/**
 * Utilizadores (admin) wire types.
 */

export type UtilizadorRow = {
  ID_User: string
  User_Name: string | null
  Read_Only: boolean | null
  Admin: boolean | null
  DT_Criacao: string | null
  Cancelado: boolean | null
  DT_Cancelado: string | null
  Obs: string | null
  Pwd?: string | null
  DT_Last_Login?: string | null
  DT_Changed_Psw?: string | null
  Fail_Login?: number | null
  NewUser?: boolean | null
}

export type AuthUser = { id: string; username: string; role: 'READER' | 'EDITOR' | 'ADMIN' }

export type OkUtilizadores = { ok: true; users: UtilizadorRow[] }
export type OkUtilizador = { ok: true; user: UtilizadorRow }
