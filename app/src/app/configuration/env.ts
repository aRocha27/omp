/**
 * Application configuration sourced from Vite env.
 *
 * `VITE_DATA_MODE` selects between mock fixtures (now) and future HTTP
 * repositories (integration phase). See INTEGRATION_PLAN.md §7.
 */
export type DataMode = 'mock' | 'api'

function readDataMode(): DataMode {
  const raw = import.meta.env.VITE_DATA_MODE
  // Default to mock; only accept 'api' explicitly. Unknown values fall back to mock.
  if (raw === 'api') return 'api'
  return 'mock'
}

export const env = {
  /** Current data mode: deterministic mock fixtures, or future API. */
  dataMode: readDataMode(),
  /** API base URL used only when dataMode === 'api'. */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  /** Whether mock data is active (convenient for UI "synthetic data" indicators). */
  isMock: readDataMode() === 'mock',
} as const