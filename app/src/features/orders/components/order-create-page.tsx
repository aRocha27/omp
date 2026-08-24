import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/page-header'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useCreateOrder } from '@/features/orders/api/use-create-order'
import { useClients } from '@/features/clients/api/use-clients'
import { areas, instrumentos, orderTypes, produtos, tipos } from '@/fixtures/reference-data'
import type { OrderCreateInput } from '@/services/contracts/orders.repository'

const today = new Date().toISOString().slice(0, 10)

export function OrderCreatePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const user = useCurrentUser()
  const mutation = useCreateOrder()
  const [clientSearch, setClientSearch] = useState('')
  const [form, setForm] = useState<OrderCreateInput>({ DT_Order: today, ID_Tp_Order: 'C', ID_Client: Number(params.get('clientId')) || undefined })
  const clients = useClients({ search: clientSearch, idTpCliente: [] })
  const set = (key: keyof OrderCreateInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value === '' ? null : value } as OrderCreateInput))
  }
  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.DT_Order || !form.ID_Client) return
    mutation.mutate(
      {
        ...form,
        ID_Client: Number(form.ID_Client),
        ID_Produto: Number(form.ID_Produto),
        ID_Instrumento: form.ID_Instrumento == null ? null : Number(form.ID_Instrumento),
        Sell_Price: form.Sell_Price == null ? null : Number(form.Sell_Price),
      },
      { onSuccess: (order) => navigate(`/orders/${order.ID_Order}`) },
    )
  }
  if (user.role === 'viewer') return <div className="p-6 text-sm text-danger">Sem permissão para criar pedidos.</div>
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-4">
      <PageHeader title="Novo pedido" description="Criar um pedido no cliente selecionado." />
      <form onSubmit={save} className="rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold">Data do pedido<Input required type="date" value={String(form.DT_Order ?? '')} onChange={(e) => set('DT_Order', e.target.value)} /></label>
          <label className="text-xs font-semibold">Tipo<Select value={String(form.ID_Tp_Order ?? '')} onChange={(e) => set('ID_Tp_Order', e.target.value)}>{orderTypes.map((o) => <option key={String(o.id)} value={String(o.id)}>{o.label}</option>)}</Select></label>
          <label className="text-xs font-semibold sm:col-span-2">Cliente
            <Input required placeholder="Pesquisar cliente..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} />
            <Select aria-label="Cliente" value={String(form.ID_Client ?? '')} onChange={(e) => set('ID_Client', e.target.value)}>
              <option value="">Selecionar cliente</option>
              {(clients.data ?? []).map((client) => <option key={client.ID_Cliente} value={client.ID_Cliente}>{client.nome ?? `Cliente ${client.ID_Cliente}`}</option>)}
            </Select>
          </label>
          <label className="text-xs font-semibold">Área<Select required value={String(form.ID_Area ?? '')} onChange={(e) => set('ID_Area', e.target.value)}><option value="">Selecionar</option>{areas.map((o) => <option key={String(o.id)} value={String(o.id)}>{o.label}</option>)}</Select></label>
          <label className="text-xs font-semibold">Tipo de produto<Select required value={String(form.ID_Tipo ?? '')} onChange={(e) => set('ID_Tipo', e.target.value)}><option value="">Selecionar</option>{tipos.map((o) => <option key={String(o.id)} value={String(o.id)}>{o.label}</option>)}</Select></label>
          <label className="text-xs font-semibold">Produto<Select required value={String(form.ID_Produto ?? '')} onChange={(e) => set('ID_Produto', e.target.value)}><option value="">Selecionar</option>{produtos.map((o) => <option key={String(o.id)} value={String(o.id)}>{o.label}</option>)}</Select></label>
          <label className="text-xs font-semibold">Instrumento<Select value={String(form.ID_Instrumento ?? '')} onChange={(e) => set('ID_Instrumento', e.target.value)}><option value="">Selecionar</option>{instrumentos.map((o) => <option key={String(o.id)} value={String(o.id)}>{o.label}</option>)}</Select></label>
          <label className="text-xs font-semibold">Sell price<Input type="number" min="0" step="0.01" value={String(form.Sell_Price ?? '')} onChange={(e) => set('Sell_Price', e.target.value)} /></label>
          <label className="text-xs font-semibold">Pedido do cliente<Input value={String(form.PO_Cliente ?? '')} onChange={(e) => set('PO_Cliente', e.target.value)} /></label>
          <label className="text-xs font-semibold sm:col-span-2">Observações<textarea className="mt-1 min-h-32 w-full rounded-md border border-border bg-surface p-3 text-sm" value={String(form.Obs ?? '')} onChange={(e) => set('Obs', e.target.value)} /></label>
        </div>
        {mutation.isError && <p role="alert" className="mb-4 rounded-md bg-danger/10 p-3 text-sm text-danger">{mutation.error.message}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/orders')}><ArrowLeft className="size-4" /> Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}><Plus className="size-4" /> {mutation.isPending ? 'A guardar...' : 'Criar pedido'}</Button>
        </div>
      </form>
    </div>
  )
}
