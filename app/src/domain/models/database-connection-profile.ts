export type NetworkMode = 'lan' | 'private-remote' | 'cloud'

/**
 * Connection metadata safe to persist in the browser.
 *
 * Passwords never belong in this model: ad-hoc passwords stay in form memory,
 * while production profile secrets are resolved by the backend.
 */
export interface DatabaseConnectionProfile {
  id: string
  name: string
  networkMode: NetworkMode
  server: string
  port: number
  database?: string
  user: string
  schema?: string
  table?: string
}
