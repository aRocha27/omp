/**
 * Application configuration sourced from Vite env.
 *
 * `VITE_DATA_MODE` selects between the live Node API (default) and mock fixtures
 * (opt-in offline dev). The live database is the only source of business truth —
 * the app ships live so orders, clients, and order-detail sub-tables show real
 * data on every launch. Mock mode is for offline dev/tests only; `clients` have no
 * mock repository, so the Clients tab is live in both modes.
 *
 * Tests always run against mock fixtures: `VITE_DATA_MODE` is ignored in the test
 * runner so the mock-backed orders tests stay deterministic without per-test env
 * wiring.
 */
export type DataMode = 'mock' | 'api'

function readDataMode(): DataMode {
  // The vitest runner sets MODE='test'; pin the orders/sub-table repositories to
  // their mock implementations there regardless of VITE_DATA_MODE so the existing
  // mock-based tests stay green without setting env per test.
  if (import.meta.env.MODE === 'test') return 'mock'
  const raw = import.meta.env.VITE_DATA_MODE
  // Default to api (live database). 'mock' is opt-in offline dev; unknown values
  // fall back to api rather than silently fabricating data.
  if (raw === 'mock') return 'mock'
  return 'api'
}

export const env = {
  /** Current data mode: live API (default) or mock fixtures (offline dev/tests). */
  dataMode: readDataMode(),
  /** API base URL for the Node API (Administration + HTTP repositories). */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  /** Whether mock data is active (convenient for UI "synthetic data" indicators). */
  isMock: readDataMode() === 'mock',
} as const
