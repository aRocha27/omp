import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { useCreateClient } from '@/features/clients/api/use-create-client'
import {
  ClientFormFields,
  draftToCreateInput,
  emptyClientDraft,
  type ClientFormDraft,
} from '@/features/clients/components/client-form'

export function ClientCreatePage() {
  const navigate = useNavigate()
  const mutation = useCreateClient()
  const [draft, setDraft] = useState<ClientFormDraft>(emptyClientDraft)

  const set = <K extends keyof ClientFormDraft>(key: K, value: ClientFormDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    const input = draftToCreateInput(draft)
    if (!input) return
    mutation.mutate(input, {
      onSuccess: (client) => navigate(`/clients/${client.ID_Cliente}`),
    })
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-4">
      <PageHeader title="New client" description="Add a new client to the directory." />
      <form onSubmit={save} className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <ClientFormFields draft={draft} onChange={set} />
        {mutation.isError && (
          <p role="alert" className="mb-4 rounded-md bg-danger/10 p-3 text-sm text-danger">
            {mutation.error.message}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/clients')}>
            <ArrowLeft className="size-4" /> Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            <Plus className="size-4" /> {mutation.isPending ? 'Saving…' : 'Create client'}
          </Button>
        </div>
      </form>
    </div>
  )
}
