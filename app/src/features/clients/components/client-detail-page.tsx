import { type ReactNode, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CircleAlert, Pencil, Save, X } from 'lucide-react'
import { useClient } from '@/features/clients/api/use-client'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useUpdateClient } from '@/features/clients/api/use-update-client'
import { canAdmin } from '@/domain/permissions'
import { tpClienteLabel } from '@/features/orders/components/reference-labels'
import { Button } from '@/components/ui/button'
import { LoadingBlock } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { ClientFormFields, type ClientFormDraft } from '@/features/clients/components/client-form'
import type { Client } from '@/domain/models/client'
import type { ClientUpdatePatch } from '@/services/contracts/clients.repository'

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

/** Pre-fill a `ClientFormDraft` from a `Client` row so the edit view opens populated. */
function clientToDraft(client: Client): ClientFormDraft {
  return {
    nome: client.nome ?? '',
    morada: client.morada ?? '',
    local: client.local ?? '',
    codpost: client.codpost ?? '',
    no_PHC: client.no_PHC == null ? '' : String(client.no_PHC),
    ncont: client.ncont ?? '',
    ID_Tp_Cliente: client.ID_Tp_Cliente == null ? '' : String(client.ID_Tp_Cliente),
    telefone: client.telefone ?? '',
    contacto: client.contacto ?? '',
    fax: client.fax ?? '',
    zona: client.zona ?? '',
  }
}

/** Compare a draft against the server row and return only the changed fields. */
function draftToPatch(draft: ClientFormDraft, client: Client): ClientUpdatePatch {
  const patch: ClientUpdatePatch = {}
  const setIfChanged = <K extends keyof Client>(
    key: K,
    next: Client[K] | null,
  ) => {
    if (client[key] !== next) patch[key as keyof ClientUpdatePatch] = next as never
  }
  setIfChanged('nome', draft.nome.trim() === '' ? null : draft.nome.trim())
  setIfChanged('morada', draft.morada.trim() === '' ? null : draft.morada.trim())
  setIfChanged('local', draft.local.trim() === '' ? null : draft.local.trim())
  setIfChanged('codpost', draft.codpost.trim() === '' ? null : draft.codpost.trim())
  setIfChanged('ncont', draft.ncont.trim() === '' ? null : draft.ncont.trim())
  setIfChanged('telefone', draft.telefone.trim() === '' ? null : draft.telefone.trim())
  setIfChanged('fax', draft.fax.trim() === '' ? null : draft.fax.trim())
  setIfChanged('contacto', draft.contacto.trim() === '' ? null : draft.contacto.trim())
  setIfChanged('zona', draft.zona.trim() === '' ? null : draft.zona.trim())

  const draftNoPhc = draft.no_PHC === '' ? null : Number(draft.no_PHC)
  if (draftNoPhc !== client.no_PHC) {
    patch.no_PHC = draftNoPhc
  }
  const draftType = draft.ID_Tp_Cliente === '' ? null : Number(draft.ID_Tp_Cliente)
  if (draftType !== client.ID_Tp_Cliente) {
    patch.ID_Tp_Cliente = draftType
  }
  return patch
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
  const user = useCurrentUser()
  const isAdmin = canAdmin(user)
  // Edit mode is local state. The button to enter edit mode is admin-only; once in edit
  // mode, a non-admin still sees the form but cannot submit (the gate below blocks them).
  const [mode, setMode] = useState<'read' | 'edit'>('read')

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{client.nome ?? 'Client'}</h1>
          <p className="mt-1 text-sm text-foreground/60">Client #{client.ID_Cliente}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isAdmin && mode === 'read' && (
            <Button variant="secondary" size="sm" onClick={() => setMode('edit')}>
              <Pencil className="size-4" aria-hidden />
              Edit
            </Button>
          )}
          <BackButton />
        </div>
      </div>

      {mode === 'edit' ? (
        isAdmin ? (
          <ClientEditForm client={client} onCancel={() => setMode('read')} />
        ) : (
          // Defence in depth: the button is hidden for non-admins, but if anyone reaches
          // edit mode by another path (e.g. a future bug) the gate still blocks them.
          <div className="rounded-md border border-border bg-surface p-4 text-sm text-danger">
            You do not have permission to edit clients.
          </div>
        )
      ) : (
        <ClientDetailView client={client} />
      )}
    </div>
  )
}

function ClientDetailView({ client }: { client: Client }) {
  return (
    <>
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
          <ReadField label="SAP no.">{displayText(client.no_PHC)}</ReadField>
          <ReadField label="Tax no.">{displayText(client.ncont)}</ReadField>
        </FieldGrid>
      </section>
    </>
  )
}

function ClientEditForm({ client, onCancel }: { client: Client; onCancel: () => void }) {
  const mutation = useUpdateClient(client.ID_Cliente)
  // Initialise the draft from the server row; subsequent edits stay local until Save.
  const initialDraft = useMemo(() => clientToDraft(client), [client])
  const [draft, setDraft] = useState<ClientFormDraft>(initialDraft)

  const set = <K extends keyof ClientFormDraft>(key: K, value: ClientFormDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    // Both numeric fields must be present for a valid save. The form's `required`
    // attribute already prevents submit when they're blank, but guard in JS too.
    if (draft.no_PHC === '' || draft.ID_Tp_Cliente === '') return
    const patch = draftToPatch(draft, client)
    if (Object.keys(patch).length === 0) {
      onCancel()
      return
    }
    mutation.mutate(patch, { onSuccess: onCancel })
  }

  return (
    <form
      onSubmit={save}
      className="rounded-lg border border-border bg-surface p-5 shadow-sm"
    >
      <ClientFormFields draft={draft} onChange={set} />
      {mutation.isError && (
        <p role="alert" className="mb-4 rounded-md bg-danger/10 p-3 text-sm text-danger">
          {mutation.error.message}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={mutation.isPending}>
          <X className="size-4" aria-hidden />
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          <Save className="size-4" aria-hidden />
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
