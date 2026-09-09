import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  BadgeCheck,
  CircleAlert,
  Clock,
  FileText,
  Package,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useOrder } from '@/features/orders/api/use-order'
import { useUpdateOrder } from '@/features/orders/api/use-update-order'
import { useReconhecimentos } from '@/features/orders/api/use-reconhecimentos'
import {
  useDocumentoFaturacao,
  useDocumentoFaturacaoTypes,
} from '@/features/orders/api/use-documento-faturacao'
import { DocumentosTable } from '@/features/orders/components/documentos-table'
import { useKitConsumables } from '@/features/orders/api/use-kit-consumables'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useRepositories } from '@/app/providers/repository-provider'
import { useClients } from '@/features/clients/api/use-clients'
import { useAreas } from '@/features/orders/api/use-areas'
import { useProdutos } from '@/features/orders/api/use-produtos'
import { useInstrumentos } from '@/features/orders/api/use-instrumentos'
import { resolveClientName } from '@/fixtures/orders'
import { formatOrderDate, formatPrice } from '@/utils/format'
import { recognitionTotals } from '@/domain/rules/recognition'
import type { Order } from '@/domain/models/order'
import type { DocumentoFaturacao } from '@/domain/models/documento-faturacao'
import type { RoleLike } from '@/domain/models/user'
import { formatAuditEntry, normalizeAuditLog, type AuditChange } from '@/domain/audit'
import { isHistorico, orderEstado } from '@/domain/orders/order-policy'
import { instrumentos, produtos } from '@/fixtures/reference-data'
import { ObservacoesEditor } from '@/features/orders/components/observacoes-editor'
import { KitConsumablesSection } from '@/features/orders/components/kit-consumables-section'
import { ReconhecimentosSection } from '@/features/orders/components/reconhecimentos-section'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, type TabItem } from '@/components/ui/tabs'
import { BackButton as UiBackButton } from '@/components/ui/back-button'
import { NotFoundState } from '@/components/ui/not-found-state'
import { displayText } from '@/components/ui/display-text'
import {
  CARACTERIZACAO_FIELDS,
  FATURACAO_FIELDS,
  KIT_FIELDS,
  REVENUE_FIELDS,
  buildPatch,
  mergeSaved,
  seedDraft,
  ALL_EDITABLE_FIELDS,
  type Draft,
} from '@/features/orders/components/order-detail-edit-model'
import type { OrderUpdatePatch } from '@/services/contracts/orders.repository'
import {
  BillingField,
  BillingFieldEditable,
  CaracterizacaoRow,
  ContactRow,
  EditableMetric,
  EstadoBadge,
  MetricCard,
  PermissaoBadge,
  ReadOnlyRow,
  SectionCard,
} from '@/features/orders/components/order-detail-ui'

/** Derived invoicing status from the net invoiced total vs Sell Price.
 *  - net == Sell Price (within money epsilon) → Fully Invoiced
 *  - net > 0 (but below Sell Price)           → Partially Invoiced
 *  - net <= 0                                  → Not Invoiced
 *  The order-level `Facturado` flag is server-set; this is the display truth. */
export function invoicingStatus(
  netInvoiced: number,
  sellPrice: number | null | undefined,
): { tone: 'success' | 'warning' | 'neutral'; label: string } {
  if (sellPrice != null && sellPrice > 0 && Math.abs(netInvoiced - sellPrice) <= 0.005) {
    return { tone: 'success', label: 'Fully Invoiced' }
  }
  if (netInvoiced > 0) return { tone: 'warning', label: 'Partially Invoiced' }
  return { tone: 'neutral', label: 'Not Invoiced' }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Sub-tables                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/* Page                                                                        */
/* ────────────────────────────────────────────────────────────────────────── */

function BackButton() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const to = typeof from === 'string' && from.startsWith('/') ? from : '/orders'
  return <UiBackButton to={to} />
}

function notFoundState(description: string) {
  return <NotFoundState description={description} title="Order not found" backTo="/orders" />
}

function auditChanges(patch: OrderUpdatePatch, order: Order): AuditChange[] {
  return ALL_EDITABLE_FIELDS.filter((field) => field.key in patch).map((field) => {
    const before = order[field.key]
    const after = patch[field.key]
    return { field: field.label, action: 'Updated', before, after }
  })
}

export function OrderDetailEmailDispatchModal({
  order,
  rows,
  role,
  onClose,
}: {
  order: Order
  rows: DocumentoFaturacao[]
  role: RoleLike
  onClose: () => void
}) {
  const { email } = useRepositories()
  const queryClient = useQueryClient()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const eligibleRows = rows.filter((row) => {
    const date = row.DT_Doc_FT?.slice(0, 10) ?? ''
    return (
      row.Imprimiu !== true &&
      row.E_Invoice !== true &&
      row.Imp_Block !== true &&
      (!from || date >= from) &&
      (!to || date <= to)
    )
  })

  async function sendDocuments() {
    setConfirming(false)
    setSending(true)
    setMessage(null)
    try {
      const result = await email.sendOrderDocuments(
        order.ID_Order,
        eligibleRows.map((row) => row.ID_Facturacao),
        role,
      )
      await queryClient.invalidateQueries({ queryKey: ['orders', 'facturacao', order.ID_Order] })
      setMessage(`Sent ${result.sent} document${result.sent === 1 ? '' : 's'} to ${result.recipient}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send email.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-documents-title"
        className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-lg border border-border bg-surface p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="email-documents-title" className="text-base font-semibold">
              Send Invoices
            </h2>
            <p className="mt-1 text-xs text-foreground/60">
              Only documents without processing flags are listed.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3 border-b border-border pb-3">
          <label className="text-xs">
            From Date
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 block h-8 rounded-md border border-border bg-surface px-2 text-xs"
            />
          </label>
          <label className="text-xs">
            To Date
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 block h-8 rounded-md border border-border bg-surface px-2 text-xs"
            />
          </label>
          <span className="text-xs text-foreground/60">
            {eligibleRows.length} document{eligibleRows.length === 1 ? '' : 's'} ready
          </span>
          <Button
            className="ml-auto"
            size="sm"
            disabled={eligibleRows.length === 0 || sending || role === 'viewer'}
            onClick={() => setConfirming(true)}
          >
            {sending ? 'Sending…' : 'Send documents'}
          </Button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-[10px] uppercase text-foreground-muted">
                <th className="px-2.5 py-1.5">Data</th>
                <th className="px-2.5 py-1.5">Documento</th>
                <th className="px-2.5 py-1.5">Nº</th>
                <th className="px-2.5 py-1.5">Nome PDF</th>
                <th className="px-2.5 py-1.5 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {eligibleRows.map((row) => (
                <tr key={row.ID_Facturacao} className="border-b border-border/50">
                  <td className="px-2.5 py-1.5 text-[11px]">{formatOrderDate(row.DT_Doc_FT)}</td>
                  <td className="px-2.5 py-1.5 text-[11px]">{row.ID_Tp_Doc_FT ?? '—'}</td>
                  <td className="px-2.5 py-1.5 text-[11px]">{row.N_Doc_FT ?? '—'}</td>
                  <td className="px-2.5 py-1.5 text-[11px]">
                    {row.Nome_PDF || `${row.N_Doc_FT ?? row.ID_Facturacao}.pdf`}
                  </td>
                  <td className="px-2.5 py-1.5 text-right text-[11px]">
                    {formatPrice(row.Valor_Doc_FT)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {eligibleRows.length === 0 && (
            <p className="p-6 text-center text-sm text-foreground/50">
              No eligible documents in this period.
            </p>
          )}
        </div>
        {message && (
          <p role="status" className="mt-3 text-xs text-foreground-muted">
            {message}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        title="Send documents"
        description={`Send ${eligibleRows.length} document${eligibleRows.length === 1 ? '' : 's'} by email and mark them as printed?`}
        confirmLabel="Send"
        busy={sending}
        onConfirm={() => void sendDocuments()}
        onClose={() => setConfirming(false)}
      />
    </div>
  )
}

export function OrderDetailPage() {
  const params = useParams<{ id: string }>()
  const idParam = params.id
  const orderId = idParam ? Number(idParam) : NaN
  const {
    data: order,
    isPending,
    isError,
    error,
  } = useOrder(Number.isNaN(orderId) ? null : orderId)

  if (Number.isNaN(orderId)) return notFoundState('The order identifier is invalid.')

  if (isPending) return <LoadingBlock label="Loading order…" />

  if (isError) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Couldn't load order"
        description={error instanceof Error ? error.message : 'Something went wrong.'}
        action={<BackButton />}
      />
    )
  }

  if (!order) return notFoundState('This order may have been removed.')

  return <OrderDetail order={order} />
}

function OrderDetail({ order }: { order: Order }) {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const { orders: ordersRepository } = useRepositories()
  const role = user.role
  const [activeTab, setActiveTab] = useState('revenue')
  const mutation = useUpdateOrder()

  const isRevenueTab = activeTab === 'revenue'
  const isKitTab = activeTab === 'kit'
  const needsDocs = true
  const recoQuery = useReconhecimentos(order.ID_Order, isRevenueTab)
  const docsQuery = useDocumentoFaturacao(order.ID_Order, needsDocs)
  const documentTypesQuery = useDocumentoFaturacaoTypes(needsDocs)
  const kitConsumablesQuery = useKitConsumables(
    order.Kit === true ? order.ID_Order : null,
    isKitTab,
  )

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>({})
  const [logs, setLogs] = useState(() => normalizeAuditLog(order.Audit ?? ''))

  const estado = useMemo(() => orderEstado(order), [order])
  const historico = useMemo(() => isHistorico(order), [order])
  const clientName = order.Client_Name ?? resolveClientName(order.ID_Client)

  // Área → Produto → Instrumento cascade. In view mode labels resolve from the static
  // fixtures (see viewValue/optionLabel), so the live queries only need to run while
  // editing — they back the parent-filtered dropdown options. The held child id is
  // merged back in (mergeSaved) so a legacy value that drifts from its parent stays
  // visible instead of vanishing from the dropdown.
  const clientsQuery = useClients({ search: '', idTpCliente: [] }, { enabled: editing })
  const areasQuery = useAreas({ enabled: editing })
  const cascadeArea = editing ? draft.ID_Area || undefined : undefined
  const produtosQuery = useProdutos({ area: cascadeArea, enabled: editing })
  const cascadeProduto = editing ? Number(draft.ID_Produto) || undefined : undefined
  const instrumentosQuery = useInstrumentos({ produto: cascadeProduto, enabled: editing })
  const clientOptions = clientsQuery.data ?? []
  const produtoOptions = mergeSaved(produtosQuery.data, draft.ID_Produto, produtos)
  const instrumentoOptions = mergeSaved(instrumentosQuery.data, draft.ID_Instrumento, instrumentos)

  function startEdit() {
    setDraft(seedDraft(order))
    setEditing(true)
  }
  function cancelEdit() {
    setEditing(false)
    setDraft({})
  }
  function recordLog(change: AuditChange) {
    const entry = formatAuditEntry(user.User_Name, change)
    setLogs((current) => (current ? `${current}\n${entry}` : entry))
    void ordersRepository
       .appendAudit(order.ID_Order, entry, role)
      .catch((reason) => {
        console.error('Could not persist order audit entry.', reason)
      })
  }
  function save() {
    const patch = buildPatch(draft, order)
    if (Object.keys(patch).length === 0) {
      setEditing(false)
      setDraft({})
      return
    }
    const changes = auditChanges(patch, order)
    mutation.mutate(
      { id: order.ID_Order, patch },
      {
        onSuccess: () => {
          changes.forEach(recordLog)
          setEditing(false)
          setDraft({})
        },
      },
    )
  }

  function setField(key: string, value: string) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  // Cascade setters mirror the create form: changing Área clears Produto + Instrumento;
  // changing Produto clears Instrumento. The child dropdowns re-filter on the next render.
  function setAreaField(value: string) {
    setDraft((d) => ({ ...d, ID_Area: value, ID_Produto: '', ID_Instrumento: '' }))
  }
  function setProdutoField(value: string) {
    setDraft((d) => ({ ...d, ID_Produto: value, ID_Instrumento: '' }))
  }

  // Recognition split (req 9): the warranty vs instrument bucket math lives in the
  // pure `recognitionTotals` helper so it stays identical in mock and HTTP repos and
  // is unit-tested. "Instrument to Recognise" = (Sell_Price − Warranty_Reserve) −
  // instrument reconhecido (the fix for the old formula that dropped the reserve).
  const recos = recoQuery.data ?? []
  const totals = recognitionTotals(order, recos)
  const {
    instrumentReconhecido,
    instrumentPorReconhecer,
    warrantyReconhecido,
    warrantyPorReconhecer,
    totalReconhecido,
  } = totals
  // req 6: green highlight on "Total Recognised" when it reaches Sell_Price.
  const fullyRecognized =
    order.Sell_Price != null &&
    order.Sell_Price > 0 &&
    Math.abs(totalReconhecido - order.Sell_Price) <= 0.005

  const docs = docsQuery.data ?? []
  const documentTypes = documentTypesQuery.data ?? []
  const documentTypesError = documentTypesQuery.isError
    ? documentTypesQuery.error instanceof Error
      ? documentTypesQuery.error.message
      : 'Could not load document types.'
    : null
  const recoError = recoQuery.isError
    ? recoQuery.error instanceof Error
      ? recoQuery.error.message
      : 'Could not load recognitions.'
    : null
  const docsError = docsQuery.isError
    ? docsQuery.error instanceof Error
      ? docsQuery.error.message
      : 'Could not load invoicing documents.'
    : null
  const netInvoiced = docs.reduce((sum, d) => sum + (d.Valor_Doc_FT ?? 0), 0)
  const porFaturar = (order.Sell_Price ?? 0) - netInvoiced

  // Kit tab (only for kit orders): Balance = Kit_Amount − Σ Kit_Consumables.Total_Price.
  // The consumables query is enabled only when order.Kit === true (above), so the
  // empty array is the correct fallback for non-kit orders and during loading.
  const kitConsumables = kitConsumablesQuery.data ?? []
  const kitConsumedTotal = kitConsumables.reduce((sum, r) => sum + (r.Total_Price ?? 0), 0)
  const kitBalance = (order.Kit_Amount ?? 0) - kitConsumedTotal
  const kitConsumablesError = kitConsumablesQuery.isError
    ? kitConsumablesQuery.error instanceof Error
      ? kitConsumablesQuery.error.message
      : 'Could not load kit consumables.'
    : null

  const canEnterEdit = role !== 'viewer'
  const canCreate = role !== 'viewer'

  const revenueMetrics = (
    <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
      <EditableMetric
        def={REVENUE_FIELDS[0]}
        order={order}
        editing={editing}
        role={role}
        value={draft[REVENUE_FIELDS[0].key] ?? ''}
        onChange={(v) => setField(REVENUE_FIELDS[0].key, v)}
        tone="blue"
        icon={ShoppingCart}
        tag="Total"
      />
      {/* Warranty Reserve only applies to warranty order kinds (req 11). */}
      {order.Tipo_Warranty === true && (
        <EditableMetric
          def={REVENUE_FIELDS[1]}
          order={order}
          editing={editing}
          role={role}
          value={draft[REVENUE_FIELDS[1].key] ?? ''}
          onChange={(v) => setField(REVENUE_FIELDS[1].key, v)}
          tone="green"
          icon={ShieldCheck}
        />
      )}
      <MetricCard
        tone="purple"
        icon={BadgeCheck}
        label="Instrument Recognised"
        value={formatPrice(instrumentReconhecido)}
      />
      <MetricCard
        tone="orange"
        icon={Clock}
        label="Instrument to Recognise"
        value={formatPrice(instrumentPorReconhecer)}
      />
      {/* Warranty KPIs only apply to warranty order kinds (req 11). */}
      {order.Tipo_Warranty === true && (
        <>
          <MetricCard
            tone="green"
            icon={ShieldCheck}
            label="Warranty Recognised"
            value={formatPrice(warrantyReconhecido)}
          />
          <MetricCard
            tone="orange"
            icon={ShieldAlert}
            label="Warranty to Recognise"
            value={formatPrice(warrantyPorReconhecer)}
          />
        </>
      )}
      <MetricCard
        tone="blue"
        icon={TrendingUp}
        label="Total Recognised"
        value={formatPrice(totalReconhecido)}
        highlight={fullyRecognized}
      />
    </div>
  )

  const tabs: TabItem[] = [
    {
      id: 'revenue',
      label: 'Revenue',
      content: (
        <div className="space-y-3 pt-3.5">
          {revenueMetrics}
          <ReconhecimentosSection
            order={order}
            rows={recos}
            role={role}
            queryError={recoError}
            onLog={recordLog}
          />
          <DocumentosTable
            order={order}
            rows={docs}
            role={role}
            documentTypes={documentTypes}
            documentTypesPending={documentTypesQuery.isPending}
            documentTypesError={documentTypesError}
            queryError={docsError}
            onLog={recordLog}
          />
        </div>
      ),
    },
    {
      id: 'faturacao',
      label: 'Invoicing',
      content: (
        <div className="space-y-3 pt-3.5">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            <MetricCard
              tone="orange"
              icon={Receipt}
              label="Remaining to Invoice"
              value={formatPrice(porFaturar)}
            />
            <MetricCard
              tone="green"
              icon={FileText}
              label="Documentos Emitidos"
              value={String(docs.length)}
            />
          </div>

          <SectionCard title="INVOICING DATA">
            <div className="grid grid-cols-2 gap-2 p-3 lg:grid-cols-4">
              <BillingFieldEditable
                def={FATURACAO_FIELDS[0]}
                order={order}
                editing={editing}
                role={role}
                value={draft[FATURACAO_FIELDS[0].key] ?? ''}
                onChange={(v) => setField(FATURACAO_FIELDS[0].key, v)}
              />
              <BillingFieldEditable
                def={FATURACAO_FIELDS[1]}
                order={order}
                editing={editing}
                role={role}
                value={draft[FATURACAO_FIELDS[1].key] ?? ''}
                onChange={(v) => setField(FATURACAO_FIELDS[1].key, v)}
              />
              <BillingFieldEditable
                def={FATURACAO_FIELDS[2]}
                order={order}
                editing={editing}
                role={role}
                value={draft[FATURACAO_FIELDS[2].key] ?? ''}
                onChange={(v) => setField(FATURACAO_FIELDS[2].key, v)}
              />
              <BillingFieldEditable
                def={FATURACAO_FIELDS[3]}
                order={order}
                editing={editing}
                role={role}
                value={draft[FATURACAO_FIELDS[3].key] ?? ''}
                onChange={(v) => setField(FATURACAO_FIELDS[3].key, v)}
              />
              <BillingField label="Sell Price">{formatPrice(order.Sell_Price)}</BillingField>
              <BillingField label="Balance to Invoice">{formatPrice(porFaturar)}</BillingField>
              <BillingField label="Status">
                {(() => {
                  const status = invoicingStatus(netInvoiced, order.Sell_Price)
                  return <Badge tone={status.tone}>{status.label}</Badge>
                })()}
              </BillingField>
            </div>
          </SectionCard>

          <DocumentosTable
            order={order}
            rows={docs}
            role={role}
            documentTypes={documentTypes}
            documentTypesPending={documentTypesQuery.isPending}
            documentTypesError={documentTypesError}
            queryError={docsError}
            onLog={recordLog}
          />
        </div>
      ),
    },
    ...(order.Kit === true
      ? [
          {
            id: 'kit',
            label: 'Kit',
            content: (
              <div className="space-y-3 pt-3.5">
                <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
                  <EditableMetric
                    def={KIT_FIELDS[1]}
                    order={order}
                    editing={editing}
                    role={role}
                    value={draft[KIT_FIELDS[1].key] ?? ''}
                    onChange={(v) => setField(KIT_FIELDS[1].key, v)}
                    tone="blue"
                    icon={Package}
                    tag="Kit"
                  />
                  <MetricCard
                    tone="green"
                    icon={Wallet}
                    label="Balance"
                    value={formatPrice(kitBalance)}
                    tag="Kit Amount − Consumido"
                  />
                  <MetricCard
                    tone="orange"
                    icon={Receipt}
                    label="Consumido"
                    value={formatPrice(kitConsumedTotal)}
                  />
                </div>
                <KitConsumablesSection
                  order={order}
                  rows={kitConsumables}
                  role={role}
                  queryError={kitConsumablesError}
                  onLog={(entry) => recordLog(entry)}
                />
              </div>
            ),
          },
        ]
      : []),
    {
      id: 'observacoes',
      label: 'Notes',
      content: (
        <div className="space-y-3 pt-3.5">
          <SectionCard title="ORDER NOTES">
            <div className="grid grid-cols-1 gap-3.5 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]">
              <ObservacoesEditor
                key={`${order.ID_Order}:${order.Obs ?? ''}`}
                order={order}
                role={role}
              />

              <div className="flex min-h-48 flex-col gap-1.5">
                <label
                  htmlFor="order-logs"
                  className="text-[9px] font-extrabold text-foreground/60"
                >
                  LOGS
                </label>
                <textarea
                  id="order-logs"
                  aria-label="Logs"
                  readOnly
                  value={logs}
                  placeholder="Field changes will appear here after Save."
                  className="min-h-48 w-full flex-1 resize-none rounded-md border border-border bg-surface-muted p-3 text-[11px] leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </div>

              <aside className="flex flex-col gap-2.5">
                <div className="rounded-md border border-border bg-surface-muted p-2.5">
                  <span className="mb-1.5 block text-[9px] font-extrabold text-foreground/60">
                    ORDER STATUS
                  </span>
                  <div className="flex min-h-[30px] items-center justify-between gap-2 border-t border-border/60 py-1.5 text-[10px] first:border-t-0">
                    <span className="text-foreground-muted">Historical</span>
                    <Badge tone={estado === 'historico' ? 'neutral' : 'success'}>
                      {estado === 'historico' ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex min-h-[30px] items-center justify-between gap-2 border-t border-border/60 py-1.5 text-[10px]">
                    <span className="text-foreground-muted">Month closed</span>
                    <Badge tone={historico ? 'neutral' : 'success'}>
                      {historico ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex min-h-[30px] items-center justify-between gap-2 border-t border-border/60 py-1.5 text-[10px]">
                    <span className="text-foreground-muted">Business closed</span>
                    <Badge tone={order.Negocio_Fechado ? 'success' : 'neutral'}>
                      {order.Negocio_Fechado ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex min-h-[30px] items-center justify-between gap-2 border-t border-border/60 py-1.5 text-[10px]">
                    <span className="text-foreground-muted">Permission</span>
                    <PermissaoBadge role={role} />
                  </div>
                </div>

                <div className="rounded-md border border-border bg-surface-muted p-2.5">
                  <span className="mb-1.5 block text-[9px] font-extrabold text-foreground/60">
                    REFERENCES
                  </span>
                  <div className="flex min-h-[30px] items-center justify-between gap-2 border-t border-border/60 py-1.5 text-[10px] first:border-t-0">
                    <span className="text-foreground-muted">ID Order</span>
                    <strong className="text-[10px] font-medium text-foreground">
                      {order.ID_Order}
                    </strong>
                  </div>
                  <div className="flex min-h-[30px] items-center justify-between gap-2 border-t border-border/60 py-1.5 text-[10px]">
                     <span className="text-foreground-muted">PO / Quote</span>
                    <strong className="text-[10px] font-medium text-foreground">
                      {displayText(order.Orc_Proposta)}
                    </strong>
                  </div>
                  <div className="flex min-h-[30px] items-center justify-between gap-2 border-t border-border/60 py-1.5 text-[10px]">
                    <span className="text-foreground-muted">Customer PO</span>
                    <strong className="text-[10px] font-medium text-foreground">
                      {displayText(order.PO_Cliente)}
                    </strong>
                  </div>
                </div>
              </aside>
            </div>
          </SectionCard>

        </div>
      ),
    },
  ]

  return (
    <div className="mx-auto w-full max-w-[1760px] px-6 py-4">
      {/* Header */}
      <div className="mb-3.5 flex items-start justify-between gap-5">
        <div className="min-w-0">
          <h1 className="text-[19px] font-bold leading-tight tracking-tight text-foreground">
            {clientName ?? 'Order'}
          </h1>
          <p className="mt-1.5 flex items-center gap-2 text-xs text-foreground/60">
            Order #{order.ID_Order}
            <span className="text-foreground/30" aria-hidden>
              •
            </span>
            {formatOrderDate(order.DT_Order)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <EstadoBadge estado={estado} />
            <PermissaoBadge role={role} />
            {historico && <Badge tone="neutral">Month closed</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <BackButton />
          {canCreate && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/orders/new?clientId=${order.ID_Client ?? ''}`)}
            >
               New from this client
            </Button>
          )}
          {canEnterEdit && !editing && (
            <Button size="sm" onClick={startEdit}>
              Edit
            </Button>
          )}
          {editing && (
            <>
              <Button size="sm" onClick={save} disabled={mutation.isPending}>
                Save
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={cancelEdit}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {mutation.isError && (
        <div
          role="alert"
          className="mb-3.5 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {mutation.error instanceof Error ? mutation.error.message : 'Could not save changes.'}
        </div>
      )}

      {/* Two-column workspace: left = caracterização + contactos, right = tabs. */}
      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[364px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <SectionCard title="ORDER CHARACTERIZATION" bodyClassName="pb-2.5">
            <ReadOnlyRow label="ID Order">{order.ID_Order}</ReadOnlyRow>
            {CARACTERIZACAO_FIELDS.map((def) => {
              // req 4/11: warranty classification fields only apply to warranty
              // order kinds (Type.Warranty = true); omit them entirely otherwise.
              const isWarrantyField =
                def.key === 'ID_Tp_Warranty' || def.key === 'Warranty_DT_Inicio'
              if (isWarrantyField && order.Tipo_Warranty !== true) return null
              // Cascade: Área/Produto/Instrumento dropdowns use the parent-filtered live
              // lists while editing; changing a parent resets its children via the
              // dedicated setters. Other fields use the static config options + setField.
              const optionsOverride =
                def.key === 'ID_Area'
                  ? areasQuery.data
                  : def.key === 'ID_Produto'
                    ? produtoOptions
                    : def.key === 'ID_Instrumento'
                      ? instrumentoOptions
                      : undefined
              const onChange =
                def.key === 'ID_Area'
                  ? setAreaField
                  : def.key === 'ID_Produto'
                    ? setProdutoField
                    : (v: string) => setField(def.key, v)
              return (
                <CaracterizacaoRow
                  key={def.key}
                  def={def}
                  order={order}
                  editing={editing}
                  role={role}
                  value={draft[def.key] ?? ''}
                  onChange={onChange}
                  optionsOverride={optionsOverride}
                  clientOptions={def.key === 'ID_Client' ? clientOptions : undefined}
                />
              )
            })}
            {/* Kit flag — editable for editor/admin (not in the month-locked set).
                Toggling it on/off here gates the Kit tab's visibility after save. */}
            <CaracterizacaoRow
              def={KIT_FIELDS[0]}
              order={order}
              editing={editing}
              role={role}
              value={draft[KIT_FIELDS[0].key] ?? ''}
              onChange={(v) => setField(KIT_FIELDS[0].key, v)}
            />
            <ReadOnlyRow label="Closed Deal">
              <Badge tone={order.Negocio_Fechado ? 'success' : 'neutral'}>
                {order.Negocio_Fechado ? 'Yes' : 'No'}
              </Badge>
            </ReadOnlyRow>
          </SectionCard>

          <SectionCard title="CONTACTOS" bodyClassName="pb-1.5">
            <ContactRow label="Email">{displayText(order.Email)}</ContactRow>
            <ContactRow label="Contacto">{displayText(order.Contacto)}</ContactRow>
              <ContactRow label="Supplier">{displayText(order.Cod_Enc_Fornecedor)}</ContactRow>
          </SectionCard>
        </div>

        <div className="min-w-0">
          <div className="overflow-x-hidden rounded-lg border border-border bg-surface shadow-sm">
            <Tabs
              tabs={tabs}
              defaultTab="revenue"
              ariaLabel="Order details"
              onChange={setActiveTab}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
