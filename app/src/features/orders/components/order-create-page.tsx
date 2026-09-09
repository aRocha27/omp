import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/page-header'
import { DatePicker } from '@/components/ui/date-picker'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useCreateOrder } from '@/features/orders/api/use-create-order'
import { useClients } from '@/features/clients/api/use-clients'
import { useAreas } from '@/features/orders/api/use-areas'
import { useProdutos } from '@/features/orders/api/use-produtos'
import { useInstrumentos } from '@/features/orders/api/use-instrumentos'
import { orderTypes, revenueTypes, tipos } from '@/fixtures/reference-data'
import type { OrderCreateInput } from '@/services/contracts/orders.repository'
import type { ClientSummary } from '@/domain/models/client'

/** UTC today as ISO `YYYY-MM-DD`. Kept in UTC so the form's default date
 * doesn't drift with the server's local clock (see TIMEZONE.md). */
function todayIso(): string {
  const now = new Date()
  const yy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

const today = todayIso()

export function OrderCreatePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const user = useCurrentUser()
  const mutation = useCreateOrder()
  // Client picker state. `clientSearch` drives the live filter; `ID_Client` (a number) is only
  // ever set by picking a result from the list — free text is never accepted as a client id, so
  // the previous bug (typing a name without selecting silently no-op'd the save) cannot recur.
  const [clientSearch, setClientSearch] = useState('')
  const [clientPickerOpen, setClientPickerOpen] = useState(false)
  // Shown when the user tries to save without picking a client from the list.
  const [clientError, setClientError] = useState('')
  const [sapOrderError, setSapOrderError] = useState('')
  const initialClientId = Number(params.get('clientId')) || undefined
  const [form, setForm] = useState<OrderCreateInput>({
    DT_Order: today,
    ID_Tp_Order: 'C',
    Encomenda_Cli_PHC: null,
    Kit: false,
    Kit_Amount: null,
    ...(initialClientId ? { ID_Client: initialClientId } : {}),
  })
  const clients = useClients({ search: clientSearch, idTpCliente: [] })
  // Área → Produto → Instrumento cascade. The dropdown options come from the live
  // reference endpoints (mock in test mode); changing a parent resets its children
  // so a stale child id can never be saved against a mismatched parent.
  const areasQuery = useAreas()
  const produtosQuery = useProdutos({ area: form.ID_Area ?? undefined })
  const instrumentosQuery = useInstrumentos({
    produto: form.ID_Produto == null ? undefined : Number(form.ID_Produto),
  })
  const isClientOrder = form.ID_Tp_Order === 'C'

  const set = (key: keyof OrderCreateInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value === '' ? null : value }) as OrderCreateInput)
  }

  const setKit = (checked: boolean) => {
    setForm((current) => ({
      ...current,
      Kit: checked,
      // A hidden amount must never leak into a non-Kit order.
      Kit_Amount: checked ? (current.Kit_Amount ?? null) : null,
    }))
  }

  // Cascade handlers: changing Área clears Produto + Instrumento; changing Produto
  // clears Instrumento. The child dropdowns re-filter from the new parent on the next
  // render, so the saved ids always belong to the selected parent.
  const setArea = (value: string) =>
    setForm(
      (current) =>
        ({
          ...current,
          ID_Area: value === '' ? null : value,
          ID_Produto: null,
          ID_Instrumento: null,
        }) as OrderCreateInput,
    )
  const setProduto = (value: string) =>
    setForm(
      (current) =>
        ({
          ...current,
          ID_Produto: value === '' ? null : value,
          ID_Instrumento: null,
        }) as OrderCreateInput,
    )

  const selectClient = (client: ClientSummary) => {
    setForm((current) => ({ ...current, ID_Client: client.ID_Cliente }))
    setClientSearch(client.nome ?? `Client ${client.ID_Cliente}`)
    setClientPickerOpen(false)
    setClientError('')
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    const sapOrderNumber = String(form.Encomenda_Cli_PHC ?? '').trim()
    if (!sapOrderNumber) {
      setSapOrderError('SAP Order Number is required.')
      return
    }
    setSapOrderError('')
    if (form.ID_Client == null) {
      setClientError('Select a client from the list.')
      return
    }
    setClientError('')
    const kit = form.Kit === true
    mutation.mutate(
      {
        ...form,
        Encomenda_Cli_PHC: sapOrderNumber,
        ID_Client: Number(form.ID_Client),
        ID_Tp_Revenue: form.ID_Tp_Revenue == null ? null : Number(form.ID_Tp_Revenue),
        ID_Produto: form.ID_Produto == null ? null : Number(form.ID_Produto),
        ID_Instrumento: form.ID_Instrumento == null ? null : Number(form.ID_Instrumento),
        Sell_Price: form.Sell_Price == null ? null : Number(form.Sell_Price),
        Kit: kit,
        Kit_Amount: kit && form.Kit_Amount != null ? Number(form.Kit_Amount) : null,
      },
      { onSuccess: (order) => navigate(`/orders/${order.ID_Order}`) },
    )
  }

  if (user.role === 'viewer')
    return <div className="p-6 text-sm text-danger">No permission to create orders.</div>
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-4">
      <PageHeader title="New order" description="Create an order for the selected client." />
      <form onSubmit={save} className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold">
            Order date
            <DatePicker
              required={isClientOrder}
              aria-label="Order date"
              value={String(form.DT_Order ?? '') || null}
              onChange={(next) => set('DT_Order', next ?? '')}
            />
          </label>
          <label className="text-xs font-semibold">
            Order type
            <Select
              required
              value={String(form.ID_Tp_Order ?? '')}
              onChange={(e) => set('ID_Tp_Order', e.target.value)}
            >
              {orderTypes.map((o) => (
                <option key={String(o.id)} value={String(o.id)}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <ClientCombobox
            search={clientSearch}
            onSearchChange={(value) => {
              setClientSearch(value)
              setClientPickerOpen(true)
              // Editing the text invalidates any previous pick — the user must choose from the
              // list again so ID_Client always tracks the displayed name.
              setForm((current) => ({ ...current, ID_Client: undefined }))
            }}
            clients={clients.data ?? []}
            open={clientPickerOpen}
            onOpenChange={setClientPickerOpen}
            onSelect={selectClient}
            error={clientError}
          />
          <label className="text-xs font-semibold">
            SAP Order Number
            <Input
              required
              value={String(form.Encomenda_Cli_PHC ?? '')}
              onChange={(e) => {
                set('Encomenda_Cli_PHC', e.target.value)
                if (e.target.value.trim()) setSapOrderError('')
              }}
              aria-describedby={sapOrderError ? 'sap-order-error' : undefined}
            />
            {sapOrderError && (
              <span
                id="sap-order-error"
                role="alert"
                className="mt-1 block text-xs font-normal text-danger"
              >
                {sapOrderError}
              </span>
            )}
          </label>
          <label className="text-xs font-semibold">
            Revenue Type
            <Select
              required={isClientOrder}
              value={String(form.ID_Tp_Revenue ?? '')}
              onChange={(e) => set('ID_Tp_Revenue', e.target.value)}
            >
              <option value="">Select</option>
              {revenueTypes.map((o) => (
                <option key={String(o.id)} value={String(o.id)}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-semibold">
            Area
            <Select
              required={isClientOrder}
              value={String(form.ID_Area ?? '')}
              onChange={(e) => setArea(e.target.value)}
            >
              <option value="">Select</option>
              {(areasQuery.data ?? []).map((o) => (
                <option key={String(o.id)} value={String(o.id)}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-semibold">
            Product type
            <Select
              required={isClientOrder}
              value={String(form.ID_Tipo ?? '')}
              onChange={(e) => set('ID_Tipo', e.target.value)}
            >
              <option value="">Select</option>
              {tipos.map((o) => (
                <option key={String(o.id)} value={String(o.id)}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-semibold">
            Product
            <Select
              required={isClientOrder}
              value={String(form.ID_Produto ?? '')}
              onChange={(e) => setProduto(e.target.value)}
              disabled={!form.ID_Area}
            >
              <option value="">Select</option>
              {(produtosQuery.data ?? []).map((o) => (
                <option key={String(o.id)} value={String(o.id)}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-semibold">
            Instrument
            <Select
              required={isClientOrder}
              value={String(form.ID_Instrumento ?? '')}
              onChange={(e) => set('ID_Instrumento', e.target.value)}
              disabled={!form.ID_Produto}
            >
              <option value="">Select</option>
              {(instrumentosQuery.data ?? []).map((o) => (
                <option key={String(o.id)} value={String(o.id)}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-semibold">
            Sell Price
            <Input
              required={isClientOrder}
              type="number"
              min="0"
              step="0.01"
              value={String(form.Sell_Price ?? '')}
              onChange={(e) => set('Sell_Price', e.target.value)}
            />
          </label>
          <label className="text-xs font-semibold">
            Customer PO
            <Input
              value={String(form.PO_Cliente ?? '')}
              onChange={(e) => set('PO_Cliente', e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-xs font-semibold">
            <Checkbox
              checked={form.Kit === true}
              onChange={(e) => setKit(e.target.checked)}
              aria-label="Kit"
            />
            <span>Kit</span>
          </label>
          {form.Kit === true && (
            <>
              <label className="text-xs font-semibold">
                Kit Amount
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={String(form.Kit_Amount ?? '')}
                  onChange={(e) => set('Kit_Amount', e.target.value)}
                />
              </label>
              <label className="text-xs font-semibold">
                Balance
                <Input type="number" value={String(form.Kit_Amount ?? '')} readOnly />
              </label>
            </>
          )}
          <label className="text-xs font-semibold sm:col-span-2">
            Notes
            <textarea
              className="mt-1 min-h-32 w-full rounded-md border border-border bg-surface p-3 text-sm"
              value={String(form.Obs ?? '')}
              onChange={(e) => set('Obs', e.target.value)}
            />
          </label>
        </div>
        {mutation.isError && (
          <p role="alert" className="mb-4 rounded-md bg-danger/10 p-3 text-sm text-danger">
            {mutation.error.message}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/orders')}>
            <ArrowLeft className="size-4" /> Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            <Plus className="size-4" /> {mutation.isPending ? 'Saving...' : 'Create order'}
          </Button>
        </div>
      </form>
    </div>
  )
}

/**
 * Client picker — a single combobox limited to the clients list.
 *
 * The search input filters `useClients`; the dropdown lists the matches. Selecting a row sets
 * `ID_Client` (a number) and closes the panel. Free text is never accepted as a client id: if
 * the user types without picking, `ID_Client` is cleared and the visible `error` guides them to
 * choose from the list. This replaces the old dual control (search Input + separate Select)
 * where typing in the search box left `ID_Client` unset and the save silently no-op'd.
 */
function ClientCombobox({
  search,
  onSearchChange,
  clients,
  open,
  onOpenChange,
  onSelect,
  error,
}: {
  search: string
  onSearchChange: (value: string) => void
  clients: readonly ClientSummary[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (client: ClientSummary) => void
  error: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const inputId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onOpenChange(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onOpenChange])

  return (
    <div ref={containerRef} className="relative text-xs font-semibold sm:col-span-2">
       <label htmlFor={inputId}>Client</label>
      <div className="relative mt-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground/40"
          aria-hidden
        />
        <Input
          id={inputId}
          className="pl-8"
           placeholder="Search clients..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => onOpenChange(true)}
          aria-controls={open ? listboxId : undefined}
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          required
        />
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs font-normal text-danger">
          {error}
        </p>
      )}
      {open && (
        <ul
          id={listboxId}
          role="listbox"
           aria-label="Clients"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg"
        >
          {clients.length === 0 ? (
            <li className="px-3 py-2 text-sm font-normal text-foreground/50">
               {search ? 'No results.' : 'Type to search.'}
            </li>
          ) : (
            clients.map((client) => (
              <li key={client.ID_Cliente} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm font-normal hover:bg-foreground/5"
                  onClick={() => onSelect(client)}
                >
                  <span className="text-foreground">
                    {client.nome ?? `Client ${client.ID_Cliente}`}
                  </span>
                  {client.no_PHC != null && (
                    <span className="text-foreground/50">SAP {client.no_PHC}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
