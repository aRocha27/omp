import { describe, expect, it, vi, afterEach } from 'vitest'
import { MockDashboardRepository } from '@/services/mock/dashboard.mock-repository'

describe('MockDashboardRepository', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('computes opening backlog and current backlog with the requested period roll-forward rule', async () => {
    // Snapshot year 2026 → cut-off = 2026-01-01. The fixture-backed backlog is:
    // Client orders booked before 2026-01-01:
    //   1001  48,500
    //   1004  39,500
    //   1005 750,000
    //   1007  12,000
    // = 850,000
    // less recognitions of those same Client orders before 2026-01-01:
    //   1001  36,455
    //   1005 600,000
    // = 636,455
    // opening backlog = 213,545
    // current backlog = opening backlog + current-year client NOB - current-year
    // recognized revenue. For the 2026 fixture there are no 2026 client orders
    // or recognitions, so the current backlog stays 213,545.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-26T12:00:00.000Z'))
    const repo = new MockDashboardRepository()

    const snapshotPromise = repo.getSnapshot()
    await vi.advanceTimersByTimeAsync(80)
    const snapshot = await snapshotPromise

    expect(snapshot.year).toBe(2026)
    expect(snapshot.kpis.backlogAtPeriodStart).toBe(213545)
    expect(snapshot.kpis.backlogToRecognize).toBe(213545)
  })
})
