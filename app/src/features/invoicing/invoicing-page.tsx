import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, CircleAlert, Euro, Search, ShieldAlert } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingBlock } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { DatePicker } from '@/components/ui/date-picker'
import { Button } from '@/components/ui/button'
import { useAuth, useCurrentUser } from '@/app/providers/user-provider'
import { DashboardMetricCard } from '@/features/dashboard/components/dashboard-metric-card'
import { useInvoicing } from '@/features/invoicing/api/use-invoicing'
import { useUpdateOrder } from '@/features/orders/api/use-update-order'
import { useUpdateWarrantyYears } from '@/features/orders/api/use-update-warranty-years'
import { formatOrderDate, formatPrice } from '@/utils/format'

export function InvoicingPage() {
  const { data, isPending, isError, error } = useInvoicing()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const updateOrder = useUpdateOrder()
  const updateWarrantyYears = useUpdateWarrantyYears()
  const [search, setSearch] = useState('')
  const [warrantyTipo, setWarrantyTipo] = useState('')
  const [warrantyDates, setWarrantyDates] = useState<Record<number, string>>({})
  const [warrantyYears, setWarrantyYears] = useState<Record<number, string>>({})
  const [expandedPanel, setExpandedPanel] = useState<'invoice' | 'warranty' | 'recognition' | null>(null)

  const filtered = useMemo(() => {
    if (!data) return null
    const searchNeedle = search.trim().toLowerCase()
    const matches = (value: string | null | undefined) =>
      searchNeedle === '' || (value ?? '').toLowerCase().includes(searchNeedle)

    return {
      notFullyInvoiced: data.notFullyInvoiced.filter(
        (row) =>
          matches(row.encomendaCliPHC) ||
          matches(row.client) ||
          matches(row.area) ||
          matches(row.type) ||
          String(row.idOrder).includes(searchNeedle),
      ),
      warrantyMissing: data.warrantyMissing.filter(
        (row) =>
          (matches(row.encomendaCliPHC) ||
            matches(row.client) ||
            matches(row.area) ||
            matches(row.type) ||
            String(row.idOrder).includes(searchNeedle)) &&
          (warrantyTipo === '' || row.idTipo === warrantyTipo),
      ),
    }
  }, [data, search, warrantyTipo])

  if (isPending) {
    return (
      <div>
        <PageHeader
          title="Invoice/Warranty"
          description="Operational invoicing views from the live database."
        />
        <LoadingBlock label="Loading invoicing…" />
      </div>
    )
  }

  if (isError) {
    return (
      <div>
        <PageHeader
          title="Invoice/Warranty"
          description="Operational invoicing views from the live database."
        />
        <EmptyState
          icon={CircleAlert}
          title="Couldn’t load invoicing"
          description={error instanceof Error ? error.message : 'Something went wrong.'}
        />
      </div>
    )
  }

  if (!data || !filtered) {
    return (
      <div>
        <PageHeader
          title="Invoice/Warranty"
          description="Operational invoicing views from the live database."
        />
        <EmptyState
          icon={Euro}
          title="No invoicing data"
          description="The invoicing endpoint returned no rows."
        />
      </div>
    )
  }

  const tipos = Array.from(
    new Set(
      data.warrantyMissing
        .map((row) => row.idTipo)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort()
  const pendingRecognition = data.pendingRecognition ?? []

  return (
    <div className="space-y-4">
      <PageHeader
        title="Invoice/Warranty"
        description="Factoring removed. This page is backed by the database invoicing views."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardMetricCard
          label="Amount to invoice"
          value={formatPrice(data.amountToInvoice)}
          meta="Sum of Diferenca from V_Orders_Nao_Faturadas_Totalmente."
          icon={Euro}
          tone="warning"
        />
        <DashboardMetricCard
          label="Orders not fully invoiced"
          value={String(data.notFullyInvoiced.length)}
          meta="Rows from V_Orders_Nao_Faturadas_Totalmente."
          icon={Euro}
          tone="violet"
        />
        <DashboardMetricCard
          label="Warranty start missing"
          value={String(data.warrantyMissing.length)}
          meta="Rows from V_Orders_Warranty_Sem_Data."
          icon={ShieldAlert}
          tone="primary"
        />
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="relative min-w-0">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground/40"
              aria-hidden
            />
            <Input
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by Order ID or Encomenda PHC"
              aria-label="Invoicing search"
            />
          </div>
          <Select
            value={warrantyTipo}
            onChange={(e) => setWarrantyTipo(e.target.value)}
            aria-label="Warranty type filter"
            className="w-full"
          >
            <option value="">All warranty types</option>
            {tipos.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </Select>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
      <TableSection
        title="Amount to invoice"
        description="dbo.V_Orders_Nao_Faturadas_Totalmente"
        expanded={expandedPanel === 'invoice'}
        onToggle={() => setExpandedPanel((current) => (current === 'invoice' ? null : 'invoice'))}
        count={{ sample: filtered.notFullyInvoiced.length, total: data.notFullyInvoiced.length }}
      >
        <table className="w-full min-w-[980px] text-sm">
          <thead className="border-b border-border text-left text-[11px] uppercase tracking-wider text-foreground/60">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Encomenda PHC</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Area</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Sell Price</th>
              <th className="px-3 py-2 text-right">Total Invoiced</th>
              <th className="px-3 py-2 text-right">Diferenca</th>
            </tr>
          </thead>
          <tbody>
            {filtered.notFullyInvoiced.map((row) => (
              <tr
                key={`${row.idOrder}-${row.encomendaCliPHC ?? ''}`}
                className="cursor-pointer border-b border-border/40"
                tabIndex={0}
                onClick={() => navigate(`/orders/${row.idOrder}`, { state: { from: '/invoicing' } })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(`/orders/${row.idOrder}`, { state: { from: '/invoicing' } })
                  }
                }}
              >
                <td className="px-3 py-2">
                  <Link
                    to={`/orders/${row.idOrder}`}
                    state={{ from: '/invoicing' }}
                    aria-label={`View order ${row.idOrder} details`}
                    className="font-medium hover:underline"
                  >
                    {row.idOrder}
                  </Link>
                </td>
                <td className="px-3 py-2">{row.encomendaCliPHC ?? '—'}</td>
                <td className="px-3 py-2">{row.client ?? '—'}</td>
                <td className="px-3 py-2">{row.area ?? '—'}</td>
                <td className="px-3 py-2">{row.type ?? '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatPrice(row.sellPrice)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatPrice(row.totalFaturado)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-warning">
                  {formatPrice(row.diferenca)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableSection>

      <TableSection
        title="Warranty Start Missing"
        description="dbo.V_Orders_Warranty_Sem_Data"
        expanded={expandedPanel === 'warranty'}
        onToggle={() => setExpandedPanel((current) => (current === 'warranty' ? null : 'warranty'))}
        count={{ sample: filtered.warrantyMissing.length, total: data.warrantyMissing.length }}
      >
        {updateOrder.isError && (
          <p
            role="alert"
            className="border-b border-danger/30 bg-danger/10 px-4 py-2 text-xs text-danger"
          >
            {updateOrder.error.message}
          </p>
        )}
        {updateWarrantyYears.isError && (
          <p
            role="alert"
            className="border-b border-danger/30 bg-danger/10 px-4 py-2 text-xs text-danger"
          >
            {updateWarrantyYears.error.message}
          </p>
        )}
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="border-b border-border text-left text-[11px] uppercase tracking-wider text-foreground/60">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Encomenda PHC</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Area</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Warranty</th>
              <th className="px-3 py-2">Warranty Years</th>
              <th className="px-3 py-2">Warranty Start</th>
              <th className="px-3 py-2 text-right">Sell Price</th>
            </tr>
          </thead>
          <tbody>
            {filtered.warrantyMissing.map((row) => (
              <tr
                key={`${row.idOrder}-${row.encomendaCliPHC ?? ''}`}
                className="cursor-pointer border-b border-border/40"
                tabIndex={0}
                onClick={() => navigate(`/orders/${row.idOrder}`, { state: { from: '/invoicing' } })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(`/orders/${row.idOrder}`, { state: { from: '/invoicing' } })
                  }
                }}
              >
                <td className="px-3 py-2">
                  <Link
                    to={`/orders/${row.idOrder}`}
                    state={{ from: '/invoicing' }}
                    aria-label={`View order ${row.idOrder} details`}
                    className="font-medium hover:underline"
                  >
                    {row.idOrder}
                  </Link>
                </td>
                <td className="px-3 py-2">{row.encomendaCliPHC ?? '—'}</td>
                <td className="px-3 py-2">{row.client ?? '—'}</td>
                <td className="px-3 py-2">{row.area ?? '—'}</td>
                <td className="px-3 py-2">{row.type ?? row.idTipo ?? '—'}</td>
                <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                  <Badge tone={row.warranty ? 'warning' : 'neutral'}>
                    {row.warranty ? 'Yes' : 'No'}
                  </Badge>
                </td>
                <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                  {user.role === 'viewer' ? (
                    row.warrantyYears == null ? (
                      '—'
                    ) : (
                      row.warrantyYears
                    )
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        className="w-20"
                        type="number"
                        min={1}
                        max={5}
                        placeholder="Years"
                        aria-label={`Warranty Years for order ${row.idOrder}`}
                        value={warrantyYears[row.idOrder] ?? String(row.warrantyYears ?? '')}
                        disabled={updateWarrantyYears.isPending}
                        onChange={(event) => {
                          const next = event.target.value
                          setWarrantyYears((current) => ({ ...current, [row.idOrder]: next }))
                        }}
                      />
                      <Button
                        size="sm"
                        disabled={
                          updateWarrantyYears.isPending ||
                          !warrantyYears[row.idOrder] ||
                          Number(warrantyYears[row.idOrder]) === row.warrantyYears
                        }
                        onClick={() => {
                          const next = Number(warrantyYears[row.idOrder])
                          if (!Number.isFinite(next)) return
                          updateWarrantyYears.mutate(
                            { id: row.idOrder, years: next },
                            {
                              onSuccess: () =>
                                setWarrantyYears((current) => {
                                  const updated = { ...current }
                                  delete updated[row.idOrder]
                                  return updated
                                }),
                            },
                          )
                        }}
                      >
                        Confirm
                      </Button>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                  {user.role === 'viewer' ? (
                    formatOrderDate(row.warrantyDtInicio)
                  ) : (
                    <div className="flex items-center gap-2">
                      <DatePicker
                        className="w-40"
                        aria-label={`Warranty Start for order ${row.idOrder}`}
                        value={
                          warrantyDates[row.idOrder] ?? row.warrantyDtInicio?.slice(0, 10) ?? null
                        }
                        disabled={updateOrder.isPending}
                        onChange={(next) => {
                          if (!next) return
                          setWarrantyDates((current) => ({ ...current, [row.idOrder]: next }))
                        }}
                      />
                      <Button
                        size="sm"
                        disabled={!warrantyDates[row.idOrder] || updateOrder.isPending}
                        onClick={() => {
                          const next = warrantyDates[row.idOrder]
                          if (!next) return
                          updateOrder.mutate(
                            { id: row.idOrder, patch: { Warranty_DT_Inicio: next } },
                            {
                              onSuccess: () =>
                                setWarrantyDates((current) => {
                                  const updated = { ...current }
                                  delete updated[row.idOrder]
                                  return updated
                                }),
                            },
                          )
                        }}
                      >
                        Confirm
                      </Button>
                    </div>
                  )}
                </td>
                <td
                  className="px-3 py-2 text-right tabular-nums"
                  onClick={(event) => event.stopPropagation()}
                >
                  {formatPrice(row.sellPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableSection>

      <TableSection
        title="Pending recognition"
        description="dbo.V_Orders_Reconhecimento_Pendente"
        expanded={expandedPanel === 'recognition'}
        onToggle={() => setExpandedPanel((current) => (current === 'recognition' ? null : 'recognition'))}
        count={{ sample: pendingRecognition.length, total: data.pendingRecognitionTotal }}
      >
        {pendingRecognition.length === 0 ? (
          <div className="p-6 text-sm text-foreground/60">No pending recognition rows were returned.</div>
        ) : (
          <table className="w-full min-w-[620px] text-sm">
            <thead className="border-b border-border text-left text-[11px] uppercase tracking-wider text-foreground/60">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Difference</th>
              </tr>
            </thead>
            <tbody>
              {pendingRecognition.map((row, index) => (
                <tr
                  key={`${row.encomendaCliPHC ?? 'missing'}-${index}`}
                  className={`${row.idOrder == null ? '' : 'cursor-pointer'} border-b border-border/40`}
                  tabIndex={row.idOrder == null ? undefined : 0}
                  onClick={() => {
                    if (row.idOrder != null) navigate(`/orders/${row.idOrder}`, { state: { from: '/invoicing' } })
                  }}
                  onKeyDown={(event) => {
                    if (row.idOrder != null && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault()
                      navigate(`/orders/${row.idOrder}`, { state: { from: '/invoicing' } })
                    }
                  }}
                >
                  <td className="px-3 py-2 font-medium">{row.idOrder ?? '—'}</td>
                  <td className="px-3 py-2">{row.client ?? '—'}</td>
                  <td className="px-3 py-2">{row.product ?? '—'}</td>
                  <td className="px-3 py-2">{row.type ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-warning">
                    {formatPrice(row.difference)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableSection>
      </section>
    </div>
  )
}

function TableSection({
  title,
  description,
  expanded,
  onToggle,
  count,
  children,
}: {
  title: string
  description: string
  expanded: boolean
  onToggle: () => void
  count: { sample: number; total?: number }
  children: ReactNode
}) {
  const { user: displayedUser } = useAuth()
  const showing = count.total !== undefined && count.total > count.sample && count.sample > 0
  const countLabel = showing
    ? `Showing ${count.sample} out of ${count.total}`
    : count.total !== undefined
      ? `${count.total} total`
      : `${count.sample}`
  return (
    <section className={`overflow-x-hidden rounded-lg border border-border bg-surface shadow-sm ${expanded ? 'md:col-span-3' : ''}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-4 text-left hover:bg-foreground/5"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span>
          <span className="block text-sm font-semibold text-foreground">{title}</span>
           {displayedUser?.Admin && <span className="mt-0.5 block text-xs text-foreground/60">{description}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span
            className="rounded-full bg-foreground/10 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground/60"
            aria-label={countLabel}
            title={countLabel}
          >
            {showing ? `${count.sample} of ${count.total}` : countLabel}
          </span>
          <ChevronDown className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
        </span>
      </button>
      {expanded && <div className="overflow-x-auto overflow-y-auto">{children}</div>}
    </section>
  )
}
