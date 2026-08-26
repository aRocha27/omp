import { useMemo, useState } from 'react'
import type { DashboardTrendPoint } from '@/domain/models/dashboard'
import { formatPrice } from '@/utils/format'

const REVENUE_COLOR = 'var(--color-primary)'
const NOB_COLOR = 'var(--color-violet)'
const MIN_CEILING_PADDING = 250_000
const CEILING_STEP = 125_000
const BAR_HEIGHT = 320

/**
 * Computes the chart ceiling so the grid always sits at least
 * `MIN_CEILING_PADDING` above the largest point, rounded up to a clean
 * `CEILING_STEP` so axis ticks line up.
 */
function computeGraphCeiling(maxValue: number): number {
  if (maxValue <= 0) return CEILING_STEP
  const padded = maxValue + MIN_CEILING_PADDING
  return Math.ceil(padded / CEILING_STEP) * CEILING_STEP
}

interface DashboardTrendChartProps {
  points: DashboardTrendPoint[]
}

function monthLabel(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function yearLabel(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function formatAxisValue(value: number): string {
  if (value >= 1_000_000) {
    return '€1M'
  }
  if (value >= 1_000) {
    return `€${Math.round(value / 1_000)}k`
  }
  return formatPrice(value)
}

export function DashboardTrendChart({ points }: DashboardTrendChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const chartYear = points[0] ? yearLabel(points[0].monthStart) : null
  const activePoint = activeIndex == null ? null : points[activeIndex] ?? null
  const graphCeiling = useMemo(
    () =>
      computeGraphCeiling(
        points.reduce((max, point) => Math.max(max, point.revenue, point.nob), 0),
      ),
    [points],
  )
  const axisTicks = useMemo(
    () => [
      graphCeiling,
      graphCeiling * 0.75,
      graphCeiling * 0.5,
      graphCeiling * 0.25,
      0,
    ],
    [graphCeiling],
  )

  if (points.length === 0) {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Monthly operational trend</h3>
            <p className="mt-1 text-xs text-foreground/60">Revenue and NOB for the current year.</p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-foreground/70">
            <LegendSwatch color={REVENUE_COLOR} label="Revenue" />
            <LegendSwatch color={NOB_COLOR} label="NOB" />
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-foreground/60">
          No monthly trend rows were returned.
        </div>
      </div>
    )
  }

  const activeOverflow = activePoint
    ? activePoint.revenue > graphCeiling || activePoint.nob > graphCeiling
    : false

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Monthly operational trend</h3>
          <p className="mt-1 text-xs text-foreground/60">
            {chartYear} Revenue vs NOB. Chart scale is capped at {formatPrice(graphCeiling)}.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <div className="flex flex-wrap gap-3 text-xs text-foreground/70">
            <LegendSwatch color={REVENUE_COLOR} label="Revenue" />
            <LegendSwatch color={NOB_COLOR} label="NOB" />
          </div>

          <div className="min-h-[88px] min-w-[240px] rounded-md border border-border bg-background/80 px-3 py-2 text-xs shadow-sm">
            {activePoint ? (
              <>
                <div className="font-medium text-foreground">{monthLabel(activePoint.monthStart)}</div>
                <div className="mt-1 space-y-1 text-foreground/70">
                  <div>Revenue: {formatPrice(activePoint.revenue)}</div>
                  <div>NOB: {formatPrice(activePoint.nob)}</div>
                </div>
                {activeOverflow ? (
                  <div className="mt-2 text-[11px] font-medium text-warning">
                    Capped on chart at {formatPrice(graphCeiling)}.
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex min-h-[72px] items-center text-foreground/55">
                Hover a month to inspect values.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-background/70 p-5">
        <div className="flex gap-4">
          <div className="hidden h-[320px] w-16 flex-col justify-between pb-8 text-right text-[11px] text-foreground/45 sm:flex">
            {axisTicks.map((tick) => (
              <span key={tick}>{formatAxisValue(tick)}</span>
            ))}
          </div>

          <div
            className="relative flex-1"
            onMouseLeave={() => setActiveIndex(null)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setActiveIndex(null)
              }
            }}
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-8">
              {axisTicks.map((tick) => (
                <div key={tick} className="border-t border-dashed border-border/60" />
              ))}
            </div>

            <div className="relative flex h-[320px] items-end gap-4 pt-2">
              {points.map((point, index) => {
                const active = index === activeIndex
                return (
                  <button
                    key={point.monthStart}
                    type="button"
                    className="group flex min-w-0 flex-1 flex-col items-center gap-3 rounded-md px-1 pb-1 pt-2 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`${monthLabel(point.monthStart)}. Revenue ${formatPrice(point.revenue)}. NOB ${formatPrice(point.nob)}.`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                  >
                    <div className="flex h-full w-full items-end justify-center gap-3 border-b border-border/70 px-1">
                      <MetricBar
                        color={REVENUE_COLOR}
                        value={point.revenue}
                        ceiling={graphCeiling}
                        active={active}
                        label={`Revenue ${formatPrice(point.revenue)}`}
                      />
                      <MetricBar
                        color={NOB_COLOR}
                        value={point.nob}
                        ceiling={graphCeiling}
                        active={active}
                        label={`NOB ${formatPrice(point.nob)}`}
                      />
                    </div>
                    <span className={`text-[11px] font-medium ${active ? 'text-foreground' : 'text-foreground/60'}`}>
                      {monthLabel(point.monthStart)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricBar({
  color,
  value,
  ceiling,
  active,
  label,
}: {
  color: string
  value: number
  ceiling: number
  active: boolean
  label: string
}) {
  const cappedValue = Math.min(value, ceiling)
  const height = `${(cappedValue / ceiling) * BAR_HEIGHT}px`
  const overflow = value > ceiling

  return (
    <span className="relative flex h-full w-7 items-end">
      <span
        aria-hidden
        className="absolute bottom-0 left-0 right-0 rounded-t-[6px] transition-all group-hover:opacity-100"
        style={{
          height,
          background: color,
          opacity: active ? 1 : 0.82,
        }}
        title={label}
      />
      {overflow ? (
        <span
          aria-hidden
          className="absolute left-[-2px] right-[-2px] top-1 h-1 rounded-full"
          style={{ background: color }}
        />
      ) : null}
    </span>
  )
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="size-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}
