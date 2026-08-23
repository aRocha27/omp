import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CircleAlert } from 'lucide-react'
import { useOrder } from '@/features/orders/api/use-order'
import { resolveClientName } from '@/fixtures/orders'
import { formatOrderDate, formatPrice } from '@/utils/format'
import type { Order } from '@/domain/models/order'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, type TabItem } from '@/components/ui/tabs'
import {
  DealStatusBadge,
  InvoicedBadge,
  RecognizedBadge,
} from '@/features/orders/components/order-status-badge'
import {
  areaLabel,
  instrumentoLabel,
  orderTypeLabel,
  produtoLabel,
} from '@/features/orders/components/reference-labels'

/** Em-dash fallback for any null/empty display value. */
const DASH = '—'

function displayText(v: string | null | undefined): string {
  return v && v.length > 0 ? v : DASH
}

function displayBool(v: boolean | null): string {
  return v == null ? DASH : v ? 'Yes' : 'No'
}

/** A labelled field cell inside a definition grid. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-foreground/50">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}

/** Sub-section heading used inside a tab panel. */
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-foreground/60 first:mt-0">
      {children}
    </h3>
  )
}

/** Definition grid shared by every tab panel. */
function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </dl>
  )
}

function BackButton() {
  const navigate = useNavigate()
  return (
    <Button variant="ghost" size="sm" onClick={() => navigate('/orders')}>
      <ArrowLeft className="size-4" aria-hidden />
      Back to orders
    </Button>
  )
}

function notFoundState(description: string) {
  return (
    <EmptyState
      icon={CircleAlert}
      title="Order not found"
      description={description}
      action={<BackButton />}
    />
  )
}

/**
 * Read-only order detail page.
 *
 * The §10 business fields are split across five tabs to keep the screen legible
 * (Overview / Client & Contact / References / Financial / Notes & Audit). The
 * edit-form layout is unknown (legacy `Form_Order.cls` was not exported), so
 * this slice renders no create/edit/delete UI.
 */
export function OrderDetailPage() {
  const params = useParams<{ id: string }>()
  const idParam = params.id
  const orderId = idParam ? Number(idParam) : NaN
  const { data: order, isPending, isError, error } = useOrder(
    Number.isNaN(orderId) ? null : orderId,
  )

  if (Number.isNaN(orderId)) {
    return notFoundState('The order identifier is invalid.')
  }

  if (isPending) {
    return <LoadingBlock label="Loading order…" />
  }

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

  if (!order) {
    return notFoundState('This order may have been removed.')
  }

  return <OrderDetail order={order} />
}

function OrderDetail({ order }: { order: Order }) {
  const clientName = resolveClientName(order.ID_Client)

  const tabs: TabItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <FieldGrid>
          <Field label="Order Date">{formatOrderDate(order.DT_Order)}</Field>
          <Field label="Order Type">{displayText(orderTypeLabel(order.ID_Tp_Order))}</Field>
          <Field label="Factory Order">
            {order.Order_Factory == null ? (
              DASH
            ) : (
              // Factory is a classification, not a done/not-done status — neutral tone.
              <Badge tone="neutral">
                {order.Order_Factory ? 'Factory' : 'Standard'}
              </Badge>
            )}
          </Field>
          <Field label="Deal Status">
            <DealStatusBadge closed={order.Negocio_Fechado} />
          </Field>
          <Field label="Facturado">
            <InvoicedBadge invoiced={order.Facturado} />
          </Field>
          <Field label="Reconhecido">
            <RecognizedBadge recognized={order.Reconhecido} />
          </Field>
          <Field label="Client Name">{displayText(clientName)}</Field>
          <Field label="Sell Price">{formatPrice(order.Sell_Price)}</Field>
          <Field label="Warranty Reserve">{formatPrice(order.Warranty_Reserve)}</Field>
          <Field label="PHC Order Ref">{displayText(order.Encomenda_Cli_PHC)}</Field>
        </FieldGrid>
      ),
    },
    {
      id: 'client',
      label: 'Client & Contact',
      content: (
        <FieldGrid>
          <Field label="Client Name">{displayText(clientName)}</Field>
          <Field label="Contact">{displayText(order.Contacto)}</Field>
          <Field label="Email">{displayText(order.Email)}</Field>
          <Field label="Customer PO">{displayText(order.PO_Cliente)}</Field>
        </FieldGrid>
      ),
    },
    {
      id: 'references',
      label: 'References',
      content: (
        <FieldGrid>
          <Field label="PHC Order Ref">{displayText(order.Encomenda_Cli_PHC)}</Field>
          <Field label="Supplier Order Ref">{displayText(order.Cod_Enc_Fornecedor)}</Field>
          <Field label="Area">{displayText(areaLabel(order.ID_Area))}</Field>
          {/* No reference-data source for ID_Tipo yet — show "—" until one is wired in. */}
          <Field label="Tipo">{DASH}</Field>
          <Field label="Product">{displayText(produtoLabel(order.ID_Produto))}</Field>
          <Field label="Instrument">{displayText(instrumentoLabel(order.ID_Instrumento))}</Field>
        </FieldGrid>
      ),
    },
    {
      id: 'financial',
      label: 'Financial',
      content: (
        <FieldGrid>
          <Field label="Sell Price">{formatPrice(order.Sell_Price)}</Field>
          <Field label="Quoted Price">{formatPrice(order.Orc_Proposta)}</Field>
          <Field label="Warranty Reserve">{formatPrice(order.Warranty_Reserve)}</Field>
          {/* No reference-data source for ID_Tp_Warranty yet — show "—" until one is wired in. */}
          <Field label="Warranty Type">{DASH}</Field>
          <Field label="Warranty Start">{formatOrderDate(order.Warranty_DT_Inicio)}</Field>
          {/* No reference-data source for ID_Tp_Revenue yet — show "—" until one is wired in. */}
          <Field label="Revenue Type">{DASH}</Field>
          <Field label="Kit">{displayBool(order.Kit)}</Field>
          <Field label="Kit Amount">{formatPrice(order.Kit_Amount)}</Field>
        </FieldGrid>
      ),
    },
    {
      id: 'notes',
      label: 'Notes & Audit',
      content: (
        <div>
          <SectionHeading>Notes</SectionHeading>
          <div className="mb-6 rounded-md border border-border bg-surface p-4">
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {order.Obs && order.Obs.length > 0 ? order.Obs : DASH}
            </p>
          </div>
          <SectionHeading>Audit</SectionHeading>
          <FieldGrid>
            {/* No user-directory source for ID_User yet — show "—" until one is wired in. */}
            <Field label="Last User">{DASH}</Field>
            <Field label="Last Updated">{formatOrderDate(order.DT_User)}</Field>
          </FieldGrid>
        </div>
      ),
    },
  ]

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <PageHeader
        // The DB surrogate (ID_Order) is not user-facing; the heading uses the
        // client name + order date instead. ID_Order stays internal as the route
        // param used to fetch the record.
        title={clientName ?? 'Order'}
        description={formatOrderDate(order.DT_Order)}
        actions={<BackButton />}
      />
      <Tabs tabs={tabs} ariaLabel="Order details" />
    </div>
  )
}