import { useState, type ReactNode } from 'react'
import { Lock, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useUpdateReconhecimento } from '@/features/orders/api/use-update-reconhecimento'
import { useDeleteReconhecimento } from '@/features/orders/api/use-delete-reconhecimento'
import { usePropagateReconhecimento } from '@/features/orders/api/use-propagate-reconhecimento'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useRepositories } from '@/app/providers/repository-provider'
import { formatOrderDate, formatPrice } from '@/utils/format'
import { reconhecimentoEstado } from '@/domain/rules/recognition'
import { planMaintenancePropagation, planWarrantyPropagation } from '@/domain/rules/propagation'
import type { Order } from '@/domain/models/order'
import type { RoleLike } from '@/domain/models/user'
import type { AuditChange } from '@/domain/audit'
import type { Reconhecimento } from '@/domain/models/reconhecimento'
import { canAddFinancial, canEditFinancial } from '@/domain/orders/order-policy'
import { tpReconhecimentos, WARRANTY_RECONHECIMENTO_CODES } from '@/fixtures/reference-data'
import { reconhecimentoLabel } from '@/features/orders/components/reference-labels'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { displayText } from '@/components/ui/display-text'

function SectionCard({
  title,
  action,
  children,
}: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="overflow-x-hidden rounded-lg border border-border bg-surface shadow-sm">
      {title && (
        <div className="flex h-9 items-center justify-between border-b border-border px-2.5 text-[11px] font-extrabold text-foreground/80">
          <span>{title}</span>
          {action}
        </div>
      )}
      <div>{children}</div>
    </section>
  )
}

export function ReconhecimentosSection({
  order,
  rows,
  role,
  queryError,
  onLog,
}: {
  order: Order
  rows: Reconhecimento[]
  role: RoleLike
  queryError: string | null
  onLog: (change: AuditChange) => void
}) {
  const orderId = order.ID_Order
  const sellPrice = order.Sell_Price
  const warrantyReserve = order.Tipo_Warranty === true ? order.Warranty_Reserve : 0
  // Warranty recognition types (W/WP) are only selectable when the order's kind
  // carries warranty (Tipo_Warranty). When Warranty=0 the warranty bucket capacity
  // is zero server-side, so the option is hidden here to prevent dead-end entries.
  const availableReconhecimentoTypes =
    order.Tipo_Warranty === true
      ? tpReconhecimentos
      : tpReconhecimentos.filter((o) => !WARRANTY_RECONHECIMENTO_CODES.includes(String(o.id)))
  const { reconhecimentos } = useRepositories()
  const queryClient = useQueryClient()
  const user = useCurrentUser()
  const updateMutation = useUpdateReconhecimento(orderId)
  const deleteMutation = useDeleteReconhecimento(orderId)
  const propagateMutation = usePropagateReconhecimento(orderId)

  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Reconhecimento | null>(null)
  const [form, setForm] = useState({
    type: 'P',
    date: new Date().toISOString().slice(0, 10),
    value: '',
  })

  // Inline row editing.
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ type: 'P', date: '', value: '' })

  // Maintenance-contract propagation dialog.
  const [contractOpen, setContractOpen] = useState(false)
  const [contractForm, setContractForm] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    recognitionDate: new Date().toISOString().slice(0, 10),
    years: '1',
  })

  // Pending propagation awaiting in-app confirmation. The native `window.confirm`
  // was replaced by `ConfirmDialog` because the browser exposes a "Prevent this
  // page from creating additional dialogs" checkbox that silently suppresses
  // every future confirmation — so the Propagate button appeared to do nothing
  // (the mutation was never fired). The in-app dialog asks fresh every time.
  type PropagateConfirm =
    | { kind: 'warranty'; description: string }
    | {
        kind: 'maintenance'
        description: string
        startDate: string
        years: number
        recognitionDate: string
      }
  const [propagateConfirm, setPropagateConfirm] = useState<PropagateConfirm | null>(null)

  const canAdd = role !== 'viewer'
  // Add (and the inline add form) is always open for any non-viewer — the user
  // explicitly asked that adding recognitions stays available even after the
  // order's month has closed. Only editing/deleting existing rows is gated.
  const canAddRow = canAddFinancial(role)
  // Editing/deleting existing rows: editor/user can do it while the order's
  // month is current or future; admin always; viewer never. Provisional orders
  // stay fully editable (handled inside canEditFinancial via isHistorico).
  const canEditRow = canEditFinancial(order, role)

  /** Remaining capacity in a recognition bucket, optionally excluding one row
   *  (the row being edited). Warranty codes W/WP draw from the Warranty_Reserve
   *  bucket; everything else draws from the instrument bucket
   *  (Sell_Price − Warranty_Reserve). Both clamp at 0 and never exceed Sell_Price
   *  in total, so req 5's "≤ Sell Price" holds. */
  function bucketCapacity(typeCode: string, excludeId: number | null = null): number {
    const isWarranty = typeCode === 'W' || typeCode === 'WP'
    const already = rows
      .filter((row) => row.ID_Reconhecimento !== excludeId)
      .filter(
        (row) =>
          (row.ID_Tp_Reconhecimento === 'W' || row.ID_Tp_Reconhecimento === 'WP') === isWarranty,
      )
      .reduce((sum, row) => sum + (row.Valor_Reconhecimento ?? 0), 0)
    const bucket = isWarranty ? (warrantyReserve ?? 0) : (sellPrice ?? 0) - (warrantyReserve ?? 0)
    return Math.max(0, bucket - already)
  }

  const capacity = bucketCapacity(form.type)

  async function handleAdd() {
    setError(null)
    const value = Number(form.value)
    if (!Number.isFinite(value) || value <= 0 || value > capacity + 0.0001) {
      setError(
        `Invalid value. Available: ${formatPrice(capacity)}. Total recognised cannot exceed the Sell Price.`,
      )
      return
    }
    setSaving(true)
    try {
      const created = await reconhecimentos.add(
        {
          ID_Order: orderId,
          ID_Tp_Reconhecimento: form.type,
          DT_Reconhecimento: new Date(form.date).toISOString(),
          Valor_Reconhecimento: value,
          ID_User: String(user.ID_User),
        },
        role,
      )
      // Reflect the new row instantly; the order's `Reconhecido` flag is
      // recomputed server-side, so refresh the detail/list in the background.
      // The recognition list is invalidated too so the server re-sorts it by
      // `DT_Reconhecimento` (the appended row may land out of order); the cached
      // rows stay on screen during the refetch, so there is no flash.
      queryClient.setQueryData<Reconhecimento[]>(['orders', 'reconhecimentos', orderId], (old) => [
        ...(old ?? []),
        created,
      ])
      queryClient.invalidateQueries({ queryKey: ['orders', 'reconhecimentos', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'list'] })
      onLog({
        field: `Recognition #${created.ID_Reconhecimento}`,
        action: 'Added',
        after: `type ${created.ID_Tp_Reconhecimento ?? '—'}, date ${created.DT_Reconhecimento?.slice(0, 10) ?? '—'}, value ${formatPrice(created.Valor_Reconhecimento ?? 0)}`,
      })
      setAdding(false)
      setForm({ type: 'P', date: new Date().toISOString().slice(0, 10), value: '' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add the recognition.')
    } finally {
      setSaving(false)
    }
  }

  function startEditRow(r: Reconhecimento) {
    setEditingId(r.ID_Reconhecimento)
    setEditForm({
      type: r.ID_Tp_Reconhecimento ?? 'P',
      date: r.DT_Reconhecimento ? r.DT_Reconhecimento.slice(0, 10) : '',
      value: r.Valor_Reconhecimento == null ? '' : String(r.Valor_Reconhecimento),
    })
    setError(null)
  }

  function saveEditRow(r: Reconhecimento) {
    const value = Number(editForm.value)
    const cap = bucketCapacity(editForm.type, r.ID_Reconhecimento)
    if (!Number.isFinite(value) || value <= 0 || value > cap + 0.0001) {
      setError(
        `Invalid value. Available: ${formatPrice(cap)}. Total recognised cannot exceed the Sell Price.`,
      )
      return
    }
    updateMutation.mutate(
      {
        id: r.ID_Reconhecimento,
        patch: {
          ID_Tp_Reconhecimento: editForm.type || null,
          DT_Reconhecimento: editForm.date ? new Date(editForm.date).toISOString() : null,
          Valor_Reconhecimento: editForm.value === '' ? null : Number(editForm.value),
        },
      },
      {
        onSuccess: () => {
          setEditingId(null)
          onLog({
            field: `Recognition #${r.ID_Reconhecimento}`,
            action: 'Updated',
            before: `type ${r.ID_Tp_Reconhecimento ?? '—'}, date ${r.DT_Reconhecimento?.slice(0, 10) ?? '—'}, value ${formatPrice(r.Valor_Reconhecimento ?? 0)}`,
            after: `type ${editForm.type || '—'}, date ${editForm.date || '—'}, value ${formatPrice(Number(editForm.value))}`,
          })
        },
        onError: (e) =>
          setError(e instanceof Error ? e.message : 'Could not save the recognition.'),
      },
    )
  }

  function handleDelete(r: Reconhecimento) {
    setDeleteTarget(r)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    const r = deleteTarget
    deleteMutation.mutate(
      { id: r.ID_Reconhecimento },
      {
        onSuccess: () => {
          onLog({
            field: `Recognition #${r.ID_Reconhecimento}`,
            action: 'Removed',
            before: `type ${r.ID_Tp_Reconhecimento ?? '—'}, value ${formatPrice(r.Valor_Reconhecimento ?? 0)}`,
          })
          setDeleteTarget(null)
        },
        onError: (e) =>
          setError(e instanceof Error ? e.message : 'Could not delete the recognition.'),
      },
    )
  }

  // Propagation availability + preview (req 10 & 12). The math lives in pure
  // domain functions so it stays identical in mock and HTTP repos.
  const warrantyPlan = planWarrantyPropagation(order)
  const canPropagateWarranty =
    order.Tipo_Warranty === true && order.ID_Tp_Warranty != null && warrantyPlan.length > 0
  const isContract = order.ID_Tipo === 'CM'
  const contractYears = Number(contractForm.years)
  const contractYearsValid =
    Number.isInteger(contractYears) && contractYears >= 1 && contractYears <= 100
  const contractPlan =
    isContract &&
    contractOpen &&
    contractYearsValid &&
    contractForm.startDate &&
    contractForm.recognitionDate
      ? planMaintenancePropagation(
          order,
          contractForm.startDate,
          contractYears,
          contractForm.recognitionDate,
        )
      : []

  function handlePropagateWarranty() {
    const monthly = warrantyPlan[0]?.value ?? 0
    setPropagateConfirm({
      kind: 'warranty',
      description: `Propagate ${warrantyPlan.length} warranty recognitions (WP) at ${formatPrice(monthly)}/month, starting ${formatOrderDate(
        warrantyPlan[0]?.date ?? null,
      )}? Total: ${formatPrice(warrantyPlan.reduce((s, l) => s + l.value, 0))}.`,
    })
  }

  function handlePropagateContract() {
    setError(null)
    const years = Number(contractForm.years)
    if (
      !contractForm.startDate ||
      !contractForm.recognitionDate ||
      !Number.isInteger(years) ||
      years < 1 ||
      years > 100
    ) {
      setError(
        'Provide the contract start date, recognition date and a whole number of years between 1 and 100.',
      )
      return
    }
    const preview = planMaintenancePropagation(
      order,
      contractForm.startDate,
      years,
      contractForm.recognitionDate,
    )
    setPropagateConfirm({
      kind: 'maintenance',
      description: `Propagate ${preview.length} maintenance recognitions (CM) at ${formatPrice(preview[0]?.value ?? 0)}/month, starting ${formatOrderDate(
        preview[0]?.date ?? null,
      )}? Total: ${formatPrice(preview.reduce((s, l) => s + l.value, 0))}.`,
      startDate: contractForm.startDate,
      years,
      recognitionDate: contractForm.recognitionDate,
    })
  }

  // Fires the deferred propagation mutation once the user confirms the in-app
  // dialog. Closing the dialog (Cancel / Escape / backdrop) clears the pending
  // request without mutating.
  function confirmPropagate() {
    if (!propagateConfirm) return
    setError(null)
    if (propagateConfirm.kind === 'warranty') {
      propagateMutation.mutate(
        { kind: 'warranty' },
        {
          onSuccess: () => {
            setPropagateConfirm(null)
            onLog({ field: 'Recognition propagation', action: 'Added', after: 'warranty rows' })
          },
          onError: (e) =>
            setError(
              e instanceof Error ? e.message : 'Could not propagate the warranty recognitions.',
            ),
        },
      )
      return
    }
    propagateMutation.mutate(
      {
        kind: 'maintenance',
        startDate: propagateConfirm.startDate,
        years: propagateConfirm.years,
        recognitionDate: propagateConfirm.recognitionDate,
      },
      {
        onSuccess: () => {
          setContractOpen(false)
          setPropagateConfirm(null)
          onLog({ field: 'Recognition propagation', action: 'Added', after: 'maintenance rows' })
        },
        onError: (e) =>
          setError(
            e instanceof Error ? e.message : 'Could not propagate the maintenance recognitions.',
          ),
      },
    )
  }

  const propagateActions = (
    <div className="flex flex-wrap items-center gap-2">
      {canPropagateWarranty && canAdd && canAddRow && (
        <Button
          size="sm"
          variant="secondary"
          onClick={handlePropagateWarranty}
          disabled={propagateMutation.isPending}
        >
          <Sparkles className="size-4" aria-hidden /> Propagate warranty
        </Button>
      )}
      {isContract && canAdd && canAddRow && !contractOpen && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setContractOpen(true)}
          disabled={propagateMutation.isPending}
        >
          <Sparkles className="size-4" aria-hidden /> Propagate contract
        </Button>
      )}
    </div>
  )

  return (
    <SectionCard
      title="RECOGNITIONS"
      action={
        <div className="flex flex-wrap items-center gap-2">
          {propagateActions}
          {canAddRow && !adding && (
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
              <Plus className="size-4" aria-hidden /> Add Recognition
            </Button>
          )}
        </div>
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
      {contractOpen && (
        <div className="flex flex-wrap items-end gap-2 border-b border-border bg-surface-muted p-3">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-foreground-muted">
            Contract start
            <DatePicker
              aria-label="Contract start"
              value={contractForm.startDate || null}
              onChange={(next) => setContractForm((f) => ({ ...f, startDate: next ?? '' }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-foreground-muted">
            Recognition date
            <DatePicker
              aria-label="Recognition date"
              value={contractForm.recognitionDate || null}
              onChange={(next) => setContractForm((f) => ({ ...f, recognitionDate: next ?? '' }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-foreground-muted">
            Years
            <Input
              type="number"
              aria-label="Contract years"
              min="1"
              max="100"
              step="1"
              value={contractForm.years}
              onChange={(e) => setContractForm((f) => ({ ...f, years: e.target.value }))}
            />
          </label>
          <Button
            size="sm"
            onClick={handlePropagateContract}
            disabled={propagateMutation.isPending}
          >
            Propagate
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setContractOpen(false)}
            disabled={propagateMutation.isPending}
          >
            Cancel
          </Button>
          {contractPlan.length > 0 && (
            <span className="text-[10px] text-foreground/60">
              {contractPlan.length} rows of {formatPrice(contractPlan[0].value)}/mo • total{' '}
              {formatPrice(contractPlan.reduce((s, l) => s + l.value, 0))}
            </span>
          )}
        </div>
      )}
      {adding && (
        <div className="flex flex-wrap items-end gap-2 border-b border-border bg-surface-muted p-3">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-foreground-muted">
            Type
            <Select
              aria-label="Recognition type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              disabled={!canAddRow}
            >
              {availableReconhecimentoTypes.map((o) => (
                <option key={String(o.id)} value={String(o.id)}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-foreground-muted">
             Date
            <DatePicker
              aria-label="Recognition date"
              value={form.date || null}
              onChange={(next) => setForm((f) => ({ ...f, date: next ?? '' }))}
              disabled={!canAddRow}
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-foreground-muted">
            Value
            <Input
              type="number"
              aria-label="Recognition value"
              value={form.value}
              min="0"
              max={capacity}
              step="0.01"
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              disabled={!canAddRow}
            />
          </label>
          <Button size="sm" onClick={handleAdd} disabled={saving || !canAddRow}>
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={saving}>
            Cancel
          </Button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="border-b border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="m-3 rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-foreground/50">
          No recognitions.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-[10px] uppercase text-foreground-muted">
                <th className="px-2.5 py-1.5 font-semibold">Type</th>
                <th className="px-2.5 py-1.5 font-semibold">Recognition Date</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Value</th>
                <th className="px-2.5 py-1.5 font-semibold">Status</th>
                {canAdd && <th className="px-2.5 py-1.5 text-right font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const estado = reconhecimentoEstado(r)
                if (editingId === r.ID_Reconhecimento) {
                  return (
                    <tr
                      key={r.ID_Reconhecimento}
                      className="border-b border-border/50 bg-surface-muted"
                    >
                      <td className="px-2.5 py-1.5">
                        <Select
                          aria-label="Recognition type"
                          value={editForm.type}
                          onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                          disabled={!canEditRow}
                        >
                          {availableReconhecimentoTypes.map((o) => (
                            <option key={String(o.id)} value={String(o.id)}>
                              {o.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-2.5 py-1.5">
                        <DatePicker
                          aria-label="Recognition date"
                          value={editForm.date || null}
                          onChange={(next) => setEditForm((f) => ({ ...f, date: next ?? '' }))}
                          disabled={!canEditRow}
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          type="number"
                          aria-label="Recognition value"
                          value={editForm.value}
                          min="0"
                          step="0.01"
                          onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))}
                          disabled={!canEditRow}
                        />
                      </td>
                      <td className="px-2.5 py-1.5" />
                      <td className="px-2.5 py-1.5 text-right">
                        <Button
                          size="sm"
                          onClick={() => saveEditRow(r)}
                          disabled={updateMutation.isPending || !canEditRow}
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
                  <tr key={r.ID_Reconhecimento} className="border-b border-border/50">
                    <td className="px-2.5 py-1.5 text-[11px]">
                      {displayText(reconhecimentoLabel(r.ID_Tp_Reconhecimento))}
                    </td>
                    <td className="px-2.5 py-1.5 text-[11px]">
                      {formatOrderDate(r.DT_Reconhecimento)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right text-[11px]">
                      {formatPrice(r.Valor_Reconhecimento)}
                    </td>
                    <td className="px-2.5 py-1.5">
                      {estado === 'reconhecido' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-semibold text-success">
                          <span className="size-1.5 rounded-full bg-success" aria-hidden />
                           Recognized
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/10 px-2 py-0.5 text-[9px] text-foreground/60">
                          <span className="size-1.5 rounded-full bg-foreground/40" aria-hidden />
                          To recognize
                        </span>
                      )}
                    </td>
                    {canAdd && canEditRow && (
                      <td className="px-2.5 py-1.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Edit recognition row ${r.ID_Reconhecimento}`}
                            onClick={() => startEditRow(r)}
                            disabled={updateMutation.isPending || deleteMutation.isPending}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete recognition row ${r.ID_Reconhecimento}`}
                            onClick={() => handleDelete(r)}
                            disabled={updateMutation.isPending || deleteMutation.isPending}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                      </td>
                    )}
                    {canAdd && !canEditRow && (
                      <td className="px-2.5 py-1.5 text-right text-[10px] text-foreground/45">
                        <span
                          className="inline-flex items-center gap-1"
                          aria-label="Field locked (month closed)"
                          title="Recognition rows are locked because this order's month has closed. Only an admin can change them."
                        >
                          <LockIcon /> Locked
                        </span>
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
        title="Delete recognition"
        description="Are you sure you want to delete this recognition? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        busy={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={propagateConfirm !== null}
        title="Propagate recognitions"
        description={propagateConfirm?.description ?? ''}
        confirmLabel="Propagate"
        cancelLabel="Cancel"
        busy={propagateMutation.isPending}
        onConfirm={confirmPropagate}
        onClose={() => setPropagateConfirm(null)}
      />
    </SectionCard>
  )
}

function LockIcon() {
  return (
    <Lock className="size-3 shrink-0 text-foreground/40" aria-label="Field locked (month closed)" />
  )
}
