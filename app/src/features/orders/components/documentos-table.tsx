import { useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useUpdateDocumentoFaturacao } from '@/features/orders/api/use-update-documento-faturacao'
import { useDeleteDocumentoFaturacao } from '@/features/orders/api/use-delete-documento-faturacao'
import { useCurrentUser } from '@/app/providers/user-provider'
import { useRepositories } from '@/app/providers/repository-provider'
import type { Order } from '@/domain/models/order'
import type { RoleLike } from '@/domain/models/user'
import type { DocumentoFaturacao } from '@/domain/models/documento-faturacao'
import type { DocumentoFaturacaoType } from '@/services/contracts/documento-faturacao.repository'
import { canAddFinancial, canEditFinancial } from '@/domain/orders/order-policy'
import { formatOrderDate, formatPrice } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { displayText } from '@/components/ui/display-text'
import type { AuditChange } from '@/domain/audit'

function LockIcon() {
  return (
    <Lock className="size-3 shrink-0 text-foreground/40" aria-label="Field locked (month closed)" />
  )
}

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
export function DocumentosTable({
  order,
  rows,
  role,
  documentTypes,
  documentTypesPending,
  documentTypesError,
  queryError,
  onLog,
}: {
  order: Order
  rows: DocumentoFaturacao[]
  role: RoleLike
  documentTypes: readonly DocumentoFaturacaoType[]
  documentTypesPending: boolean
  documentTypesError: string | null
  queryError: string | null
  onLog: (change: AuditChange) => void
}) {
  const orderId = order.ID_Order
  const sellPrice = order.Sell_Price
  const { facturacao } = useRepositories()
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const updateMutation = useUpdateDocumentoFaturacao(orderId)
  const deleteMutation = useDeleteDocumentoFaturacao(orderId)

  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DocumentoFaturacao | null>(null)
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: '',
    number: '',
    value: '',
  })

  // Inline row editing.
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ date: '', type: '', number: '', value: '' })

  const defaultDocumentType =
    documentTypes.find((type) => type.id === 'FT')?.id ?? documentTypes[0]?.id ?? ''
  const documentTypeLabels = useMemo(
    () => new Map(documentTypes.map((type) => [type.id, type.label])),
    [documentTypes],
  )

  const canAdd = role !== 'viewer'
  // Adding a new invoice is always open for any non-viewer; only edit/delete
  // of existing rows is gated by the month lock. (canAddFinancial / canEditFinancial)
  const canAddRow = canAddFinancial(role)
  const canEditRow = canEditFinancial(order, role)
  const netInvoiced = rows.reduce((sum, d) => sum + (d.Valor_Doc_FT ?? 0), 0)
  // req 6: green highlight when the net invoiced equals Sell_Price.
  const fullyInvoiced =
    sellPrice != null && sellPrice > 0 && Math.abs(netInvoiced - sellPrice) <= 0.005

  /** Net invoiced excluding one row (the row being edited). Used to enforce
   *  req 5's "net faturado ≤ Sell Price" on the client. */
  function netExcluding(excludeId: number | null): number {
    return rows
      .filter((d) => d.ID_Facturacao !== excludeId)
      .reduce((sum, d) => sum + (d.Valor_Doc_FT ?? 0), 0)
  }

  function validateDoc(value: number, otherNet: number): string | null {
    if (!Number.isFinite(value)) return 'Invalid value.'
    if (sellPrice != null && otherNet + value > sellPrice + 0.005) {
      return `Net invoiced cannot exceed the Sell Price (${formatPrice(sellPrice)}).`
    }
    return null
  }

  /** Remaining capacity left before the next invoice tips the cumulative net over
   *  Sell_Price. Negative when the typed value already pushes past the limit, so
   *  the user sees the overage inline while typing (req D). */
  function remainingCapacity(existingNet: number, value: number): number | null {
    if (sellPrice == null || sellPrice <= 0) return null
    return sellPrice - existingNet - value
  }

  function startAdd() {
    setForm((current) => ({
      ...current,
      type: current.type || defaultDocumentType,
    }))
    setError(null)
    setAdding(true)
  }

  async function handleAdd() {
    if (!form.type || !form.number || form.value === '') return
    setError(null)
    const value = Number(form.value)
    const msg = validateDoc(value, netInvoiced)
    if (msg) {
      setError(msg)
      return
    }
    setSaving(true)
    try {
      const created = await facturacao.add(
        {
          ID_Order: orderId,
          DT_Doc_FT: new Date(form.date).toISOString(),
          ID_Tp_Doc_FT: form.type,
          N_Doc_FT: form.number,
          Valor_Doc_FT: Number(form.value),
          ID_User: String(user.ID_User),
        },
        role,
      )
      // Reflect the new document instantly; the order's `Facturado` flag is
      // recomputed server-side, so refresh the detail/list in the background.
      // The invoicing list is invalidated too so the server re-sorts it by
      // `DT_Doc_FT` (the appended row may land out of order); the cached rows
      // stay on screen during the refetch, so there is no flash.
      queryClient.setQueryData<DocumentoFaturacao[]>(['orders', 'facturacao', orderId], (old) => [
        ...(old ?? []),
        created,
      ])
      queryClient.invalidateQueries({ queryKey: ['orders', 'facturacao', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'list'] })
      onLog({
        field: `Facturacao #${created.ID_Facturacao}`,
        action: 'Added',
        after: `document ${created.N_Doc_FT ?? '—'}, type ${created.ID_Tp_Doc_FT ?? '—'}, value ${formatPrice(created.Valor_Doc_FT ?? 0)}`,
      })
      setAdding(false)
      setForm({
        date: new Date().toISOString().slice(0, 10),
        type: defaultDocumentType,
        number: '',
        value: '',
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not add the document.')
    } finally {
      setSaving(false)
    }
  }

  function startEditRow(d: DocumentoFaturacao) {
    setEditingId(d.ID_Facturacao)
    setEditForm({
      date: d.DT_Doc_FT ? d.DT_Doc_FT.slice(0, 10) : '',
      type: d.ID_Tp_Doc_FT ?? defaultDocumentType,
      number: d.N_Doc_FT ?? '',
      value: d.Valor_Doc_FT == null ? '' : String(d.Valor_Doc_FT),
    })
    setError(null)
  }

  function saveEditRow(d: DocumentoFaturacao) {
    if (!editForm.number || editForm.value === '') return
    const value = Number(editForm.value)
    const msg = validateDoc(value, netExcluding(d.ID_Facturacao))
    if (msg) {
      setError(msg)
      return
    }
    updateMutation.mutate(
      {
        id: d.ID_Facturacao,
        patch: {
          DT_Doc_FT: editForm.date ? new Date(editForm.date).toISOString() : null,
          ID_Tp_Doc_FT: editForm.type || null,
          N_Doc_FT: editForm.number,
          Valor_Doc_FT: Number(editForm.value),
        },
      },
      {
        onSuccess: () => {
          setEditingId(null)
          const changes: AuditChange[] = [
            {
              field: `Facturacao#${d.ID_Facturacao}.DT_Doc_FT`,
              action: 'Updated',
              before: d.DT_Doc_FT?.slice(0, 10),
              after: editForm.date,
            },
            {
              field: `Facturacao#${d.ID_Facturacao}.ID_Tp_Doc_FT`,
              action: 'Updated',
              before: d.ID_Tp_Doc_FT,
              after: editForm.type,
            },
            {
              field: `Facturacao#${d.ID_Facturacao}.N_Doc_FT`,
              action: 'Updated',
              before: d.N_Doc_FT,
              after: editForm.number,
            },
            {
              field: `Facturacao#${d.ID_Facturacao}.Valor_Doc_FT`,
              action: 'Updated',
              before: formatPrice(d.Valor_Doc_FT),
              after: formatPrice(Number(editForm.value)),
            },
          ]
          changes.forEach((change) => {
            if (change.before !== change.after) onLog(change)
          })
        },
        onError: (e) => setError(e instanceof Error ? e.message : 'Could not save the document.'),
      },
    )
  }

  function handleDelete(d: DocumentoFaturacao) {
    setDeleteTarget(d)
  }

  function updateFlag(
    row: DocumentoFaturacao,
    field: 'Imprimiu' | 'E_Invoice' | 'Imp_Block',
    checked: boolean,
  ) {
    updateMutation.mutate(
      { id: row.ID_Facturacao, patch: { [field]: checked } },
      {
        onSuccess: () =>
          onLog({
            field: `Facturacao#${row.ID_Facturacao}.${field}`,
            action: 'Updated',
            before: row[field] === true,
            after: checked,
          }),
        onError: (e) => setError(e instanceof Error ? e.message : 'Could not update the document.'),
      },
    )
  }

  function confirmDelete() {
    if (!deleteTarget) return
    const d = deleteTarget
    deleteMutation.mutate(
      { id: d.ID_Facturacao },
      {
        onSuccess: () => {
          onLog({
            field: `Facturacao #${d.ID_Facturacao}`,
            action: 'Removed',
            before: `document ${d.N_Doc_FT ?? '—'}, value ${formatPrice(d.Valor_Doc_FT ?? 0)}`,
          })
          setDeleteTarget(null)
        },
        onError: (e) => setError(e instanceof Error ? e.message : 'Could not delete the document.'),
      },
    )
  }

  return (
    <SectionCard
      title="DOCUMENTOS FATURADOS"
      action={
        canAdd && canAddRow && !adding && documentTypes.length > 0 ? (
          <Button size="sm" variant="secondary" onClick={startAdd}>
            <Plus className="size-4" aria-hidden /> Add documento
          </Button>
        ) : undefined
      }
    >
      {documentTypesPending && (
        <p className="border-b border-border px-3 py-2 text-xs text-foreground/60">
          A carregar tipos de documento…
        </p>
      )}
      {queryError && (
        <p
          role="alert"
          className="border-b border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {queryError}
        </p>
      )}
      {documentTypesError && (
        <p
          role="alert"
          className="border-b border-danger/20 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {documentTypesError}
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
          No documents.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-[10px] uppercase text-foreground-muted">
                <th className="px-2.5 py-1.5 font-semibold">Data</th>
                <th className="px-2.5 py-1.5 font-semibold">Documento</th>
                <th className="px-2.5 py-1.5 font-semibold">Nº</th>
                <th className="px-2.5 py-1.5 text-right font-semibold">Value</th>
                <th className="px-2.5 py-1.5 font-semibold">Nome PDF</th>
                <th className="px-2.5 py-1.5 font-semibold">Processing</th>
                {canAdd && <th className="px-2.5 py-1.5 text-right font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {adding && (
                <tr className="border-b border-border/50 bg-surface-muted">
                  <td className="px-2.5 py-1.5">
                    <DatePicker
                      aria-label="Document date"
                      value={form.date || null}
                      onChange={(next) => setForm((f) => ({ ...f, date: next ?? '' }))}
                      disabled={!canAddRow}
                    />
                  </td>
                  <td className="px-2.5 py-1.5">
                    <Select
                      aria-label="Document type"
                      value={form.type}
                      onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                      disabled={!canAddRow}
                    >
                      {documentTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.label}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-2.5 py-1.5">
                    <Input
                      aria-label="Document number"
                      placeholder="Nº documento"
                      value={form.number}
                      onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                      disabled={!canAddRow}
                    />
                  </td>
                  <td className="px-2.5 py-1.5">
                    <div className="flex flex-col gap-1">
                      <Input
                        aria-label="Document value"
                        type="number"
                        step="0.01"
                        value={form.value}
                        onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                        disabled={!canAddRow}
                      />
                      <DocumentRemainingHint
                        remaining={remainingCapacity(
                          netInvoiced,
                          Number.isFinite(Number(form.value)) ? Number(form.value) : 0,
                        )}
                      />
                    </div>
                  </td>
                  <td className="px-2.5 py-1.5" />
                  <td className="px-2.5 py-1.5" />
                  <td className="px-2.5 py-1.5 text-right">
                    <Button size="sm" onClick={handleAdd} disabled={saving || !canAddRow}>
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
              {rows.map((d) => {
                if (editingId === d.ID_Facturacao) {
                  return (
                    <tr
                      key={d.ID_Facturacao}
                      className="border-b border-border/50 bg-surface-muted"
                    >
                      <td className="px-2.5 py-1.5">
                        <DatePicker
                          aria-label="Document date"
                          value={editForm.date || null}
                          onChange={(next) => setEditForm((f) => ({ ...f, date: next ?? '' }))}
                          disabled={!canEditRow}
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Select
                          aria-label="Document type"
                          value={editForm.type}
                          onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                          disabled={!canEditRow}
                        >
                          {editForm.type && !documentTypeLabels.has(editForm.type) && (
                            <option value={editForm.type}>{editForm.type}</option>
                          )}
                          {documentTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.label}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-2.5 py-1.5">
                        <Input
                          aria-label="Document number"
                          value={editForm.number}
                          onChange={(e) => setEditForm((f) => ({ ...f, number: e.target.value }))}
                          disabled={!canEditRow}
                        />
                      </td>
                      <td className="px-2.5 py-1.5">
                        <div className="flex flex-col gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            aria-label="Document value"
                            value={editForm.value}
                            onChange={(e) => setEditForm((f) => ({ ...f, value: e.target.value }))}
                            disabled={!canEditRow}
                          />
                          <DocumentRemainingHint
                            remaining={remainingCapacity(
                              netExcluding(d.ID_Facturacao),
                              Number.isFinite(Number(editForm.value)) ? Number(editForm.value) : 0,
                            )}
                          />
                        </div>
                      </td>
                      <td className="px-2.5 py-1.5" />
                      <td className="px-2.5 py-1.5" />
                      <td className="px-2.5 py-1.5 text-right">
                        <Button
                          size="sm"
                          onClick={() => saveEditRow(d)}
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
                  <tr key={d.ID_Facturacao} className="border-b border-border/50">
                    <td className="px-2.5 py-1.5 text-[11px]">{formatOrderDate(d.DT_Doc_FT)}</td>
                    <td className="px-2.5 py-1.5 text-[11px]">
                      {displayText(
                        d.ID_Tp_Doc_FT
                          ? (documentTypeLabels.get(d.ID_Tp_Doc_FT) ?? d.ID_Tp_Doc_FT)
                          : null,
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 text-[11px]">{displayText(d.N_Doc_FT)}</td>
                    <td className="px-2.5 py-1.5 text-right text-[11px]">
                      {formatPrice(d.Valor_Doc_FT)}
                    </td>
                    <td className="px-2.5 py-1.5 text-[11px]">
                      {d.Nome_PDF || (d.N_Doc_FT ? `${d.N_Doc_FT}.pdf` : '—')}
                    </td>
                    <td className="px-2.5 py-1.5 text-[11px]">
                      <div className="flex flex-wrap gap-x-2.5 gap-y-1">
                        {([
                          ['Imprimiu', d.Imprimiu, 'Imprimiu'],
                          ['E_Invoice', d.E_Invoice, 'E_Invoice'],
                          ['Block Print', d.Imp_Block, 'Imp_Block'],
                        ] as const).map(([label, value, field]) => (
                          <label key={label} className="inline-flex items-center gap-1 whitespace-nowrap">
                            <input
                              type="checkbox"
                              aria-label={`${label} for document ${d.ID_Facturacao}`}
                              checked={value === true}
                              disabled={!canEditRow || updateMutation.isPending}
                              onChange={(event) => updateFlag(d, field, event.target.checked)}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </td>
                    {canAdd && canEditRow && (
                      <td className="px-2.5 py-1.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Edit document row ${d.ID_Facturacao}`}
                            onClick={() => startEditRow(d)}
                            disabled={updateMutation.isPending || deleteMutation.isPending}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete document row ${d.ID_Facturacao}`}
                            onClick={() => handleDelete(d)}
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
                          title="Invoicing documents are locked because this order's month has closed. Only an admin can change them."
                        >
                          <LockIcon /> Locked
                        </span>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr
                data-highlight={fullyInvoiced ? 'true' : undefined}
                className={fullyInvoiced ? 'bg-success/15 text-success' : 'text-foreground/60'}
              >
                <td className="px-2.5 py-1.5 text-[11px] font-semibold" colSpan={5}>
                  Net faturado
                </td>
                <td className="px-2.5 py-1.5 text-right text-[11px] font-semibold">
                  {formatPrice(netInvoiced)}
                </td>
                {canAdd && <td className="px-2.5 py-1.5" />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete invoice document"
        description="Are you sure you want to delete this invoicing document? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        busy={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </SectionCard>
  )
}

/** Tiny live hint that sits under the new-document value input. Renders nothing when
 *  the order has no Sell_Price (the cap doesn't apply); shows the remaining capacity
 *  when within budget, or the overage when the typed value would push past it. The
 *  user sees the gap update as they type, so they know whether the line will be
 *  accepted before pressing Add. */
export function DocumentRemainingHint({ remaining }: { remaining: number | null }) {
  if (remaining === null) return null
  if (remaining >= 0) {
    return (
      <p aria-live="polite" className="text-[11px] text-foreground/50">
        Remaining to Sell Price: {formatPrice(remaining)}
      </p>
    )
  }
  return (
    <p role="alert" aria-live="polite" className="text-[11px] font-medium text-danger">
      Exceeds Sell Price by {formatPrice(-remaining)}
    </p>
  )
}
