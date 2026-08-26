import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardTrendChart } from '@/features/dashboard/components/dashboard-trend-chart'
import type { DashboardTrendPoint } from '@/domain/models/dashboard'

const points: DashboardTrendPoint[] = [
  { monthStart: '2026-01-01T00:00:00.000Z', revenue: 1200, nob: 2400 },
  { monthStart: '2026-02-01T00:00:00.000Z', revenue: 800, nob: 1600 },
]

// The chart ceiling is now derived from the data (max + 250k, rounded up to
// the next 125k step) so the highest bar is always at least 250k below the
// top of the chart. With that rule no single point can exceed the ceiling,
// so the "Capped" hover message is no longer reachable in normal use.
// (It used to trigger when a value was above the static 500k ceiling.)
const overflowPoints: DashboardTrendPoint[] = [
  { monthStart: '2026-01-01T00:00:00.000Z', revenue: 1_200_000, nob: 850_000 },
]

describe('DashboardTrendChart', () => {
  it('shows hover guidance before a month is selected', () => {
    render(<DashboardTrendChart points={points} />)

    expect(screen.getByText('Hover a month to inspect values.')).toBeInTheDocument()
    expect(screen.queryByText('Month')).not.toBeInTheDocument()
  })

  it('shows the selected month details on hover and clears them on mouse leave', async () => {
    const user = userEvent.setup()
    render(<DashboardTrendChart points={points} />)

    const januaryButton = screen.getByRole('button', {
      name: /Jan\. Revenue €1,200\.00\. NOB €2,400\.00\./i,
    })

    await user.hover(januaryButton)

    expect(screen.getByText('Revenue: €1,200.00')).toBeInTheDocument()
    expect(screen.getByText('NOB: €2,400.00')).toBeInTheDocument()

    await user.unhover(januaryButton)

    expect(screen.getByText('Hover a month to inspect values.')).toBeInTheDocument()
    expect(screen.queryByText('Revenue: €1,200.00')).not.toBeInTheDocument()
  })

  it('renders a hover pill with the values and never goes above the chart ceiling', async () => {
    // The ceiling is derived as `max + 250k` rounded up to the next `125k`
    // step (computed from the input data, not a constant). With a single
    // point the ceiling is high enough to leave headroom, so the "Capped"
    // message that the old static-ceiling chart showed is not reached.
    const user = userEvent.setup()
    render(<DashboardTrendChart points={overflowPoints} />)

    const januaryButton = screen.getByRole('button', {
      name: /Jan\. Revenue €1,200,000\.00\. NOB €850,000\.00\./i,
    })

    await user.hover(januaryButton)

    expect(screen.getByText('Revenue: €1,200,000.00')).toBeInTheDocument()
    expect(screen.getByText('NOB: €850,000.00')).toBeInTheDocument()
    // No "Capped" pill — the dynamic ceiling always gives the value headroom.
    expect(screen.queryByText(/Capped on chart at/)).not.toBeInTheDocument()
  })
})
