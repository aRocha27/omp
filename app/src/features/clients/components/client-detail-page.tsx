import { type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CircleAlert } from 'lucide-react'
import { useClient } from '@/features/clients/api/use-client'
import { tpClienteLabel } from '@/features/orders/components/reference-labels'
import { Button } from '@/components/ui/button'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import type { Client } from '@/domain/models/client'

/** Em-dash fallback for any null/empty display value (mirrors order-detail). */
const DASH = '—'

function displayText(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return DASH
  const s = String(v)
  return s.length > 0 ? s : DASH
}

/** Read-only labelled value (definition-list dt/dd, mirrors order-detail's ReadField). */
function ReadField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-foreground/50">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}

/** Definition grid shared by the detail sections (mirrors order-detail's FieldGrid). */
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
    <Button variant="ghost" size="sm" onClick={() => navigate('/clients')}>
      <ArrowLeft className="size-4" aria-hidden />
      Back
    </Button>
  )
}

function notFoundState(description: string) {
  return (
    <EmptyState
      icon={CircleAlert}
      title="Client not found"
      description={description}
      action={<BackButton />}
    />
  )
}

export function ClientDetailPage() {
  const params = useParams<{ id: string }>()
  const idParam = params.id
  const clientId = idParam ? Number(idParam) : NaN
  const { data: client, isPending, isError, error } = useClient(
    Number.isNaN(clientId) ? null : clientId,
  )

  if (Number.isNaN(clientId)) return notFoundState('The client identifier is invalid.')

  if (isPending) return <LoadingBlock label="Loading client…" />

  if (isError) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Couldn't load client"
        description={error instanceof Error ? error.message : 'Something went wrong.'}
        action={<BackButton />}
      />
    )
  }

  if (!client) return notFoundState('This client may have been removed.')

  return <ClientDetail client={client} />
}

function ClientDetail({ client }: { client: Client }) {
  const nome = client.nome ?? 'Client'

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{nome}</h1>
          <p className="mt-1 text-sm text-foreground/60">Client #{client.ID_Cliente}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BackButton />
        </div>
      </div>

      {/* Contact */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/70">
          Contact
        </h2>
        <FieldGrid>
          <ReadField label="Phone">{displayText(client.telefone)}</ReadField>
          <ReadField label="Fax">{displayText(client.fax)}</ReadField>
          <ReadField label="Contact name">{displayText(client.contacto)}</ReadField>
        </FieldGrid>
      </section>

      {/* Address */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/70">
          Address
        </h2>
        <FieldGrid>
          <ReadField label="Street address">{displayText(client.morada)}</ReadField>
          <ReadField label="Location">{displayText(client.local)}</ReadField>
          <ReadField label="Postal code">{displayText(client.codpost)}</ReadField>
          <ReadField label="Zone">{displayText(client.zona)}</ReadField>
        </FieldGrid>
      </section>

      {/* Classification */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/70">
          Classification
        </h2>
        <FieldGrid>
          <ReadField label="Type">{displayText(tpClienteLabel(client.ID_Tp_Cliente))}</ReadField>
          <ReadField label="PHC no.">{displayText(client.no_PHC)}</ReadField>
          <ReadField label="Tax no.">{displayText(client.ncont)}</ReadField>
        </FieldGrid>
      </section>
    </div>
  )
}