import { useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  useAddKitConsumable,
  useDeleteKitConsumable,
  useUpdateKitConsumable,
} from '@/features/orders/api/use-kit-consumables'
import { invalidateOrderAggregate } from '@/features/orders/api/invalidate-order-aggregate'
import type { KitConsumable } from '@/domain/models/kit-consumable'
import type { Order } from '@/domain/models/order'
import type { RoleLike } from '@/domain/models/user'
import type { AuditChange } from '@/domain/audit'
import { formatOrderDate, formatPrice } from '@/utils/format'
import { displayText, DASH } from '@/components/ui/display-text'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'

function SectionCard({
  title,
  action,
  children,
  bodyClassName,
  className,
}: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  bodyClassName?: string
  className?: string
}) {
  return (
    <section
      className={`overflow-x-hidden rounded-lg border border-border bg-surface shadow-sm ${className ?? ''}`}
    >
      {title && (
        <div className="flex h-9 items-center justify-between border-b border-border px-2.5 text-[11px] font-extrabold text-foreground/80">
          <span>{title}</span>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

/** Sub-table of Kit_Consumables for an order (dbo.Kit_Consumables). Mirrors the
 *  ReconhecimentosSection shape — inline add/edit/delete (trash fires the
 *  mutation directly, no confirm dialog) — but without capacity enforcement:
 *  the Balance (Kit_Amount − Σ Total_Price) is display-only, computed by the
 *  parent Kit tab. dbo.Kit_Consumables has no audit columns, so no
 *  ID_User/DT_User are sent. */
export function KitConsumablesSection({
  order,
  rows,
  role,
  queryError,
  onLog,
}: {
  order: Order
  rows: KitConsumable[]
  role: RoleLike
  queryError: string | null
  onLog: (change: AuditChange) => void
}) {
  const orderId = order.ID_Order
  const queryClient = useQueryClient()
  const addMutation = useAddKitConsumable(orderId)
  const updateMutation = useUpdateKitConsumable(orderId)
  const deleteMutation = useDeleteKitConsumable(orderId)

  const canAdd = role !== 'viewer'

  const emptyForm = () => ({
    date: new Date().toISOString().slice(0, 10),
    internalOrder: '',
    material: '',
    description: '',
    quant: '',
    unitPrice: '',
    totalPrice: '',
  })

  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KitConsumable | null>(null)
  const [form, setForm] = useState(emptyForm)

  // Inline row editing.
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)

  /** Recompute Total_Price = Quant × Unit_Price when either changes, unless the
   *  user has overridden it. Kept simple: always recompute from the two inputs. */
  function withComputedTotal(f: ReturnType<typeof emptyForm>): ReturnType<typeof emptyForm> {
    const quant = Number(f.quant)
    const unit = Number(f.unitPrice)
    const computed =
      Number.isFinite(quant) && Number.isFinite(unit) ? String(round2(quant * unit)) : ''
    return { ...f, totalPrice: computed }
  }

  /** Σ Total_Price of the rows already persisted. Used by both the add and the
   *  edit paths so the cap check stays in one place (validateKitForm). */
  const existingTotal = rows.reduce((sum, r) => sum + (r.Total_Price ?? 0), 0)

  async function handleAdd() {
    setError(null)
    const validation = validateKitForm(form, existingTotal, order.Kit_Amount ?? null)
    if (validation) {
      setError(validation)
      return
    }
    setSaving(true)
    try {
      const created = await addMutation.mutateAsync({
        ID_Order: orderId,
        Date: new Date(form.date).toISOString(),
        Internal_Order: form.internalOrder,
        Material: form.material,
        Description: form.description,
        Quant: Number(form.quant),
        Unit_Price: Number(form.unitPrice),
        Total_Price: Number(form.totalPrice),
      })
      // The mutation hook appends the returned row directly to the cache. Refresh
      // from server truth in the background so ordering and the detail remain fresh.
      void queryClient.invalidateQueries({ queryKey: ['orders', 'kit-consumables', orderId] })
      invalidateOrderAggregate(queryClient, orderId)
      onLog({
        field: `Kit consumable #${created.ID_Kit}`,
        action: 'Added',
        after: form.material || form.description || 'item',
      })
      setAdding(false)
      setForm(emptyForm())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add the kit consumable.')
    } finally {
      setSaving(false)
    }
  }

  function startEditRow(r: KitConsumable) {
    setEditingId(r.ID_Kit)
    setEditForm({
      date: r.Date ? r.Date.slice(0, 10) : '',
      internalOrder: r.Internal_Order ?? '',
      material: r.Material ?? '',
      description: r.Description ?? '',
      quant: r.Quant == null ? '' : String(r.Quant),
      unitPrice: r.Unit_Price == null ? '' : String(r.Unit_Price),
      totalPrice: r.Total_Price == null ? '' : String(r.Total_Price),
    })
    setError(null)
  }

  function saveEditRow(r: KitConsumable) {
    // Exclude the row being edited from the existing total so its own value isn't
    // counted twice in the cap check.
    const totalExcludingSelf = existingTotal - (r.Total_Price ?? 0)
    const validation = validateKitForm(editForm, totalExcludingSelf, order.Kit_Amount ?? null)
    if (validation) {
      setError(validation)
      return
    }
    updateMutation.mutate(
      {
        id: r.ID_Kit,
        patch: {
          Date: new Date(editForm.date).toISOString(),
          Internal_Order: editForm.internalOrder,
          Material: editForm.material,
          Description: editForm.description,
          Quant: Number(editForm.quant),
          Unit_Price: Number(editForm.unitPrice),
          Total_Price: Number(editForm.totalPrice),
        },
      },
      {
        onSuccess: () => {
          setEditingId(null)
          onLog({
            field: `Kit consumable #${r.ID_Kit}`,
            action: 'Updated',
            before: `${r.Material ?? '—'} | ${r.Quant ?? '—'} | ${formatPrice(r.Total_Price ?? 0)}`,
            after: `${editForm.material || '—'} | ${editForm.quant || '—'} | ${formatPrice(Number(editForm.totalPrice))}`,
          })
        },
        onError: (e) =>
          setError(e instanceof Error ? e.message : 'Could not save the kit consumable.'),
      },
    )
  }

  function handleDelete(r: KitConsumable) {
    setDeleteTarget(r)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    const r = deleteTarget
    deleteMutation.mutate(
      { id: r.ID_Kit },
      {
        onSuccess: () => {
          onLog({
            field: `Kit consumable #${r.ID_Kit}`,
            action: 'Removed',
            before: r.Material ?? r.Description ?? 'item',
          })
          setDeleteTarget(null)
        },
        onError: (e) =>
          setError(e instanceof Error ? e.message : 'Could not delete the kit consumable.'),
      },
    )
  }

  return (
    <SectionCard
           title="KIT CONSUMABLES"
      action={
        canAdd &&
        !adding && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden /> Add Consumable
          </Button>
        )
      }
    >
      {queryError && (
        <p
          role="alert"
          className="border-b border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {queryError}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="border-b border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {error}
        </p>
      )}

      {rows.length === 0 && !adding ? (
        <p className="m-3 rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-foreground/50">
          No kit consumables.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-[10px] uppercase text-foreground-muted">
                <th className="px-2.5 py-1.5 font-semibold">Data</th>
                <th className="px-2.5 py-1.5 font-semibold">Internal Order</th>
                <th className="px-2.5 py-1.5 font-semibold">Material</th>
                <th className="px-2.5 py-1.5 font-semibold">Description</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Quant</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Unit Price</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Total</th>
                {canAdd && <th className="px-2.5 py-1.5 text-right font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {adding && (
                <tr className="border-b border-border/50 bg-surface-muted">
                  <KitConsumableForm form={form} onChange={(f) => setForm(withComputedTotal(f))} />
                  <td className="px-2.5 py-1.5 text-right">
                    <Button size="sm" onClick={handleAdd} disabled={saving}>
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAdding(false)}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                if (editingId === r.ID_Kit) {
                  return (
                    <tr key={r.ID_Kit} className="border-b border-border/50 bg-surface-muted">
                      <td className="px-2.5 py-1.5">
                        <DatePicker
                          aria-label="Consumable date"
                          value={editForm.date || null}
                          onChange={(next) =>
                            setEditForm(withComputedTotal({ ...editForm, date: next ?? '' }))
                          }
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="text"
                          aria-label="Internal order"
                          value={editForm.internalOrder}
                          onChange={(e) =>
                            setEditForm(
                              withComputedTotal({ ...editForm, internalOrder: e.target.value }),
                            )
                          }
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="text"
                          aria-label="Material"
                          value={editForm.material}
                          onChange={(e) =>
                            setEditForm(
                              withComputedTotal({ ...editForm, material: e.target.value }),
                            )
                          }
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="text"
                          aria-label="Description"
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm(
                              withComputedTotal({ ...editForm, description: e.target.value }),
                            )
                          }
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="number"
                          aria-label="Quantity"
                          min="1"
                          step="1"
                          value={editForm.quant}
                          onChange={(e) =>
                            setEditForm(withComputedTotal({ ...editForm, quant: e.target.value }))
                          }
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="number"
                          aria-label="Unit price"
                          min="0"
                          step="0.01"
                          value={editForm.unitPrice}
                          onChange={(e) =>
                            setEditForm(
                              withComputedTotal({ ...editForm, unitPrice: e.target.value }),
                            )
                          }
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="number"
                          aria-label="Total"
                          min="0"
                          step="0.01"
                          value={editForm.totalPrice}
                          onChange={(e) => setEditForm({ ...editForm, totalPrice: e.target.value })}
                        />
                      </td>
                      <td className="px-2.5 py-1.5 text-right">
                        <Button
                          size="sm"
                          onClick={() => saveEditRow(r)}
                          disabled={updateMutation.isPending}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          disabled={updateMutation.isPending}
                        >
                          Cancel
                        </Button>
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr key={r.ID_Kit} className="border-b border-border/50">
                    <td className="px-2.5 py-1.5 text-[11px]">{formatOrderDate(r.Date)}</td>
                    <td className="px-2.5 py-1.5 text-[11px]">{displayText(r.Internal_Order)}</td>
                    <td className="px-2.5 py-1.5 text-[11px]">{displayText(r.Material)}</td>
                    <td className="px-2.5 py-1.5 text-[11px]">{displayText(r.Description)}</td>
                    <td className="px-2.5 py-1.5 text-right text-[11px]">{r.Quant ?? DASH}</td>
                    <td className="px-2.5 py-1.5 text-right text-[11px]">
                      {formatPrice(r.Unit_Price)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right text-[11px]">
                      {formatPrice(r.Total_Price)}
                    </td>
                    {canAdd && (
                      <td className="px-2.5 py-1.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Edit kit consumable ${r.ID_Kit}`}
                            onClick={() => startEditRow(r)}
                            disabled={updateMutation.isPending || deleteMutation.isPending}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete kit consumable ${r.ID_Kit}`}
                            onClick={() => handleDelete(r)}
                            disabled={updateMutation.isPending || deleteMutation.isPending}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete kit consumable"
        description="Are you sure you want to delete this kit consumable? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        busy={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </SectionCard>
  )
}

/** The inline add-form fields (Date, Internal Order, Material, Description, Quant,
 *  Unit Price, Total). Total is auto-computed by the caller; it stays editable so
 *  a user can override a rounded/adjusted value. */
function KitConsumableForm({
  form,
  onChange,
}: {
  form: ReturnType<
    () => {
      date: string
      internalOrder: string
      material: string
      description: string
      quant: string
      unitPrice: string
      totalPrice: string
    }
  >
  onChange: (f: typeof form) => void
}) {
  // Renders the seven field cells for the inline "add consumable" row. The
  // caller wraps these in a `<tr>` inside the consumables `<tbody>` so the
  // layout matches the inline-edit row exactly (one compact cell per field,
  // no vertical labels above each input).
  return (
    <>
      <td className="px-2.5 py-1.5">
        <DatePicker
          aria-label="Consumable date"
          value={form.date || null}
          onChange={(next) => onChange({ ...form, date: next ?? '' })}
        />
      </td>
      <td className="px-2.5 py-1.5">
        <Input
          type="text"
          aria-label="Internal order"
          value={form.internalOrder}
          onChange={(e) => onChange({ ...form, internalOrder: e.target.value })}
        />
      </td>
      <td className="px-2.5 py-1.5">
        <Input
          type="text"
          aria-label="Material"
          value={form.material}
          onChange={(e) => onChange({ ...form, material: e.target.value })}
        />
      </td>
      <td className="px-2.5 py-1.5">
        <Input
          type="text"
          aria-label="Description"
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
        />
      </td>
      <td className="px-2.5 py-1.5">
        <Input
          type="number"
          aria-label="Quantity"
          min="1"
          step="1"
          value={form.quant}
          onChange={(e) => onChange({ ...form, quant: e.target.value })}
        />
      </td>
      <td className="px-2.5 py-1.5">
        <Input
          type="number"
          aria-label="Unit price"
          min="0"
          step="0.01"
          value={form.unitPrice}
          onChange={(e) => onChange({ ...form, unitPrice: e.target.value })}
        />
      </td>
      <td className="px-2.5 py-1.5">
        <Input
          type="number"
          aria-label="Total"
          min="0"
          step="0.01"
          value={form.totalPrice}
          onChange={(e) => onChange({ ...form, totalPrice: e.target.value })}
        />
      </td>
    </>
  )
}

/** Validate a kit-consumable form. Returns an English error message or null.
 *
 *  `existingTotal` is the Σ Total_Price of the rows already persisted for this
 *  order; when editing, the caller subtracts the row being edited from that sum
 *  first so we never double-count. `kitAmount` is the order's Kit_Amount cap
 *  (req G3): the new total must fit under it, otherwise the save is rejected
 *  with a message that names the remaining budget. */
function validateKitForm(
  f: {
    date: string
    internalOrder: string
    material: string
    description: string
    quant: string
    unitPrice: string
    totalPrice: string
  },
  existingTotal: number,
  kitAmount: number | null,
): string | null {
  if (!f.date) return 'Date is required.'
  if (!f.internalOrder.trim()) return 'Internal order is required.'
  if (!f.material.trim()) return 'Material is required.'
  if (!f.description.trim()) return 'Description is required.'
  const quant = Number(f.quant)
  if (!Number.isFinite(quant) || quant <= 0 || !Number.isInteger(quant)) {
    return 'Quantity must be a positive integer.'
  }
  const unit = Number(f.unitPrice)
  if (!Number.isFinite(unit) || unit < 0) return 'Invalid unit price.'
  const total = Number(f.totalPrice)
  if (!Number.isFinite(total) || total < 0) return 'Invalid total.'
  if (kitAmount != null && existingTotal + total > kitAmount + 0.005) {
    const remaining = Math.max(0, kitAmount - existingTotal)
    return `Kit amount would be exceeded. Remaining budget: ${formatPrice(remaining)}.`
  }
  return null
}

/** Round to 2 decimals (money). Avoids floating-point noise like 0.30000000000000004. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
