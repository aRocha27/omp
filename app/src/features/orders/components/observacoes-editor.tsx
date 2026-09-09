import { useState } from 'react'
import { useUpdateOrder } from '@/features/orders/api/use-update-order'
import type { Order } from '@/domain/models/order'
import type { RoleLike } from '@/domain/models/user'
import { Button } from '@/components/ui/button'

export function ObservacoesEditor({ order, role }: { order: Order; role: RoleLike }) {
  const mutation = useUpdateOrder()
  const [value, setValue] = useState(order.Obs ?? '')
  const canSave = role !== 'viewer'

  function save() {
    if (!canSave || value === (order.Obs ?? '')) return
    mutation.mutate({ id: order.ID_Order, patch: { Obs: value || null } })
  }

  return (
    <div className="p-3">
      <textarea
        aria-label="Notes"
        disabled={!canSave || mutation.isPending}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="min-h-48 w-full resize-y rounded-md border border-border bg-surface p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />
      {mutation.isError && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {mutation.error.message}
        </p>
      )}
      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          onClick={save}
          disabled={!canSave || mutation.isPending || value === (order.Obs ?? '')}
        >
          Save notes
        </Button>
      </div>
    </div>
  )
}
