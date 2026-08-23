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

/** Em-dash fallback for any null/empty display value. */
const DASH = '—'

function displayBool(v: boolean | null): string {
  return v == null ? DASH : v ? 'Yes' : 'No'
}

function displayText(v: string | null | undefined): string {
  return v && v.length > 0 ? v : DASH
}

function displayNumber(v: number | null | undefined): string {
  return v == null ? DASH : String(v)
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

/** Section heading that separates logical groups of fields. */
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-foreground/60">
      {children}
    </h2>
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
 * Displays every §10 business field of a single `Order` using the mock
 * repository. The edit-form layout is unknown (legacy `Form_Order.cls` was not
 * exported), so this slice intentionally renders no create/edit/delete UI.
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
  const dealClosed = order.Negocio_Fechado
  const factory = order.Order_Factory

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <PageHeader
        title={`Order #${order.ID_Order}`}
        description={formatOrderDate(order.DT_Order)}
        actions={<BackButton />}
      />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
        <SectionHeading>Identification</SectionHeading>
        <Field label="Order ID">{order.ID_Order}</Field>
        <Field label="Order Date">{formatOrderDate(order.DT_Order)}</Field>
        <Field label="Order Type">{displayText(order.ID_Tp_Order)}</Field>
        <Field label="Factory Order">
          {factory == null ? (
            DASH
          ) : (
            <Badge tone={factory ? 'success' : 'neutral'}>
              {factory ? 'Factory' : 'Standard'}
            </Badge>
          )}
        </Field>
        <Field label="Deal Status">
          {dealClosed == null ? (
            DASH
          ) : (
            <Badge tone={dealClosed ? 'success' : 'neutral'}>
              {dealClosed ? 'Closed' : 'Open'}
            </Badge>
          )}
        </Field>
        <Field label="Facturado">{displayBool(order.Facturado)}</Field>
        <Field label="Reconhecido">{displayBool(order.Reconhecido)}</Field>

        <SectionHeading>Client / contact</SectionHeading>
        <Field label="Client ID">{displayNumber(order.ID_Client)}</Field>
        <Field label="Client Name">{displayText(clientName)}</Field>
        <Field label="Contact">{displayText(order.Contacto)}</Field>
        <Field label="Email">{displayText(order.Email)}</Field>
        <Field label="Customer PO">{displayText(order.PO_Cliente)}</Field>

        <SectionHeading>References</SectionHeading>
        <Field label="PHC Order Ref">{displayText(order.Encomenda_Cli_PHC)}</Field>
        <Field label="Supplier Order Ref">{displayText(order.Cod_Enc_Fornecedor)}</Field>
        <Field label="Area ID">{displayNumber(order.ID_Area)}</Field>
        <Field label="Tipo ID">{displayNumber(order.ID_Tipo)}</Field>
        <Field label="Produto ID">{displayNumber(order.ID_Produto)}</Field>
        <Field label="Instrumento ID">{displayNumber(order.ID_Instrumento)}</Field>

        <SectionHeading>Financial</SectionHeading>
        <Field label="Sell Price">{formatPrice(order.Sell_Price)}</Field>
        <Field label="Quoted Price">{formatPrice(order.Orc_Proposta)}</Field>
        <Field label="Warranty Reserve">{formatPrice(order.Warranty_Reserve)}</Field>
        <Field label="Warranty Type">{displayText(order.ID_Tp_Warranty)}</Field>
        <Field label="Warranty Start">{formatOrderDate(order.Warranty_DT_Inicio)}</Field>
        <Field label="Revenue Type">{displayText(order.ID_Tp_Revenue)}</Field>
        <Field label="Kit">{displayBool(order.Kit)}</Field>
        <Field label="Kit Amount">{formatPrice(order.Kit_Amount)}</Field>

        <SectionHeading>Audit</SectionHeading>
        <Field label="Last User">{displayText(order.ID_User)}</Field>
        <Field label="Last Updated">{formatOrderDate(order.DT_User)}</Field>
      </dl>

      <SectionHeading>Notes</SectionHeading>
      <div className="rounded-md border border-border bg-surface p-4">
        <p className="whitespace-pre-wrap text-sm text-foreground">
          {order.Obs && order.Obs.length > 0 ? order.Obs : DASH}
        </p>
      </div>
    </div>
  )
}