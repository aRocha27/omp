/**
 * Shared timing helpers used by every mock repository.
 *
 * The original per-repo declarations the audit found duplicated used
 * 120 ms by default; `dashboard` and `invoicing` used 80 ms. To preserve
 * exact parity with the pre-refactor tests (some of which drive
 * `vi.advanceTimersByTimeAsync(80)` to flush the read-only repos'
 * simulated latency), the defaults stay per-repo. The `delay()`
 * promise wrapper used to be redefined in every repo.
 *
 * Centralising these here means a single place to swap the mock
 * "network" feel for a config flag if tests ever need to disable it.
 */

export const READ_ONLY_MOCK_LATENCY_MS = 80
export const WRITE_MOCK_LATENCY_MS = 120

/** Wrapper around `setTimeout` returning a promise, mirroring the helper
 *  that used to be redefined in every mock repository. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}