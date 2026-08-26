import { useState, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, CircleAlert, Search, X, Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingBlock } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useClients } from '@/features/clients/api/use-clients'
import { ClientsTable } from '@/features/clients/components/clients-table'
import { tpClientes } from '@/fixtures/reference-data'
import type { ClientSearchFilters } from '@/domain/models/client'

/** Initial/cleared filter state: search empty, no type selected. */
const emptyFilters: ClientSearchFilters = { search: '', idTpCliente: [] }

/** "All" sentinel for the type `<select>` — the empty string means "no filter". */
const ALL_TYPES = ''

export function ClientsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<ClientSearchFilters>(emptyFilters)

  const { data, isPending, isError, error } = useClients(filters)

  const clients = data ?? []
  const hasActiveFilters = filters.search.trim() !== '' || filters.idTpCliente.length > 0

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Client directory."
        actions={
          <Button size="sm" onClick={() => navigate('/clients/new')}>
            <Plus className="size-4" />
            New client
          </Button>
        }
      />

      <ClientsFilters value={filters} onChange={setFilters} />

      {isPending ? (
        <LoadingBlock label="Loading clients…" />
      ) : isError ? (
        <EmptyState
          icon={CircleAlert}
          title="Couldn’t load clients"
          description={error instanceof Error ? error.message : 'Something went wrong.'}
        />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasActiveFilters ? 'No clients match these filters' : 'No clients yet'}
          description={
            hasActiveFilters
              ? 'Try clearing some filters to see more results.'
              : 'Clients will appear here once they are added.'
          }
          action={
            hasActiveFilters ? (
              <Button size="sm" variant="secondary" onClick={() => setFilters(emptyFilters)}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ClientsTable data={clients} onRowClick={(id) => navigate(`/clients/${id}`)} />
      )}
    </div>
  )
}

interface ClientsFiltersProps {
  value: ClientSearchFilters
  onChange: (next: ClientSearchFilters) => void
}

/** Filter bar for the clients list: a search input + a type `<select>` + Clear. */
function ClientsFilters({ value, onChange }: ClientsFiltersProps) {
  const searchId = useId()
  const typeId = useId()
  const set = <K extends keyof ClientSearchFilters>(key: K, next: ClientSearchFilters[K]) =>
    onChange({ ...value, [key]: next })

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor={searchId}
          className="text-[11px] font-medium uppercase tracking-wider text-foreground/50"
        >
          Search
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground/40" aria-hidden />
          <Input
            id={searchId}
            className="w-72 pl-8"
            placeholder="Search by name, tax no., or SAP no."
            value={value.search}
            onChange={(e) => set('search', e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={typeId}
          className="text-[11px] font-medium uppercase tracking-wider text-foreground/50"
        >
          Type
        </label>
        <Select
          id={typeId}
          className="w-64"
          aria-label="Client type"
          value={value.idTpCliente.length > 0 ? String(value.idTpCliente[0]) : ALL_TYPES}
          onChange={(e) => {
            const v = e.target.value
            set('idTpCliente', v === ALL_TYPES ? [] : [Number(v)])
          }}
        >
          <option value={ALL_TYPES}>All</option>
          {tpClientes.map((o) => (
            <option key={String(o.id)} value={String(o.id)}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange(emptyFilters)}
        className="text-foreground/60"
      >
        <X className="size-4" aria-hidden />
        Clear
      </Button>
    </div>
  )
}