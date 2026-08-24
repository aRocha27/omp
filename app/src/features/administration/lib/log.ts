// Dev-only console logging for the Administration feature.
//
// In `vite dev` (where the operator runs the app) import.meta.env.DEV is true,
// so every API call prints a clear trail to the browser console: the request
// method/path, whether the admin token was attached, the response status,
// and the backend error code/message when something fails. The request body
// (which carries the database password) and the token value itself are NEVER
// logged — only whether a token was present.
//
// In a production build DEV is false and every function is a no-op, so this
// adds zero noise to shipped bundles at runtime.

const ENABLED = Boolean(import.meta.env.DEV)

export function logInfo(...parts: unknown[]): void {
  if (ENABLED) console.log('[Administration]', ...parts)
}

export function logWarn(...parts: unknown[]): void {
  if (ENABLED) console.warn('[Administration]', ...parts)
}

export function logError(...parts: unknown[]): void {
  if (ENABLED) console.error('[Administration]', ...parts)
}