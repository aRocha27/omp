import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { useCurrentUser } from '@/app/providers/user-provider'
import { createMasterData, deleteMasterData, fetchMasterData, masterDataTables, updateMasterData, type ConnectionSource, type SyncResult } from '@/features/administration/api/admin-api'

type ForeignKey = { table: string; key: string; label: string }
const FOREIGN_KEYS: Record<string, Record<string, ForeignKey>> = {
   Produto: { ID_Area: { table: 'Area', key: 'ID_Area', label: 'Area' } },
   Instrumento: { ID_Produto: { table: 'Produto', key: 'ID_Produto', label: 'Produto' } },
   Tipo: { ID_Grp_Report: { table: 'Grp_Report', key: 'ID_Grp_Report', label: 'Grp_Report' } },
}
const SEARCH_FIELDS: Record<string, readonly string[]> = {
  Area: ['ID_Area', 'Area'], ChargeCategory: ['ID', 'Desc'], Grp_Report: ['ID_Grp_Report', 'Grp_Report'],
  Produto: ['ID_Produto', 'Produto', 'Produto_Cod', 'ID_Area'], ServiceType: ['ID', 'Desc'],
  Tipo: ['ID_Tipo', 'Tipo', 'ID_Grp_Report', 'Warranty'], Tp_Cliente: ['ID_Tp_Cliente', 'Tp_Cliente'],
  Tp_Doc_FT: ['ID_Tp_Doc_FT', 'Tp_Doc_FT'], Tp_Order: ['ID_Tp_Order', 'Tp_Order', 'Provisoria'],
  Tp_Reconhecimento: ['ID_Tp_Reconhecimento', 'Tp_Reconhecimento'], Tp_Revenue: ['ID_Tp_Revenue', 'Tp_Revenue'],
  Tp_Warranty: ['ID_Tp_Warranty', 'Tp_Warranty'], Instrumento: ['ID_Instrumento', 'Instrumento', 'ID_Produto'],
  Utilizador: ['ID_User', 'User_Name', 'Admin', 'Cancelado'], stck_Materiais: ['ref', 'description', 'familia', 'localizacao'],
  stck_Armazens: ['id_arm', 'arm', 'arm_desc'],
}
const MATERIALS_PAGE_SIZE = 100

export function MasterDataMaintenance({ source }: { source?: ConnectionSource | null }) {
  const user = useCurrentUser(); const queryClient = useQueryClient()
  const [table, setTable] = useState<string>(masterDataTables[0][1]); const [result, setResult] = useState<SyncResult | null>(null)
  const [values, setValues] = useState<Record<string, string>>({}); const [search, setSearch] = useState<Record<string, string>>({}); const [page, setPage] = useState(0); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}); const [editingKey, setEditingKey] = useState<string | null>(null)
  const [linkedRows, setLinkedRows] = useState<Record<string, Record<string, unknown>[]>>({}); const [pendingDelete, setPendingDelete] = useState<Record<string, unknown> | null>(null)

  async function load(selected = table) {
    setBusy(true); setError(null)
     try { setResult(await fetchMasterData(selected, user.role, source)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load table.') } finally { setBusy(false) }
  }
  // Loading is intentionally triggered when the selected table changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [table, source])
  useEffect(() => {
    const parents = Array.from(new Set(Object.values(foreignKeysFor(table)).map((foreignKey) => foreignKey.table)))
    void Promise.all(parents.map(async (parent) => [parent, (await fetchMasterData(parent, user.role, source)).rows] as const)).then((entries) => setLinkedRows(Object.fromEntries(entries))).catch(() => setLinkedRows({}))
  }, [table, user.role, source])

  const columns = result?.columns ?? []; const key = columns[0]
  const searchFields = (SEARCH_FIELDS[table] ?? columns).filter((column) => columns.includes(column))
  const filteredRows = (result?.rows ?? []).filter((row) => searchFields.every((column) => !search[column]?.trim() || displayValue(table, column, row, linkedRows).toLowerCase().includes(search[column].trim().toLowerCase())))
  const paginatedRows = table === 'stck_Materiais' ? filteredRows.slice(page * MATERIALS_PAGE_SIZE, (page + 1) * MATERIALS_PAGE_SIZE) : filteredRows
  const pageCount = table === 'stck_Materiais' ? Math.max(1, Math.ceil(filteredRows.length / MATERIALS_PAGE_SIZE)) : 1
  const firstVisiblePage = Math.max(0, page - 10)
  const lastVisiblePage = Math.min(pageCount - 1, page + 10)
  const visiblePages = Array.from({ length: lastVisiblePage - firstVisiblePage + 1 }, (_, index) => firstVisiblePage + index)
  const materialTotal = result?.totalRows ?? filteredRows.length
  const inputColumns = table === 'Utilizador'
    ? editingKey == null
      ? ['ID_User', 'User_Name', 'Read_Only', 'Admin'].filter((column) => columns.includes(column))
      : columns.filter((column) => !['upsize_ts', 'DT_User'].includes(column))
    : columns.filter((column) => !['upsize_ts', 'ID_User', 'DT_User', 'ID', 'ID_Instrumento', 'ID_Tp_Cliente', 'ID_Tp_Revenue', 'ID_Tp_Warranty'].includes(column) && (foreignKeyFor(table, column) !== undefined || !['ID_Grp_Report', 'ID_Produto'].includes(column)))
  const setValue = (column: string, value: string) => setValues((current) => ({ ...current, [column]: value }))

  async function save() {
    const errors: Record<string, string> = {}
    for (const column of inputColumns) { const value = values[column] ?? ''; if (requiredField(table, column) && !value.trim()) errors[column] = `${column} is required.`; if (value && numericField(column) && !Number.isFinite(Number(value))) errors[column] = `${column} must be a number.` }
    setFieldErrors(errors); if (Object.keys(errors).length) { setError('Correct the highlighted fields before saving.'); return }; setBusy(true); setError(null)
     try { const payload = Object.fromEntries(Object.entries(values).map(([column, value]) => [column, databaseValue(column, value)])); setResult(editingKey == null ? await createMasterData(table, payload, user.role, source) : await updateMasterData(table, key!, editingKey, payload, user.role, source)); setValues({}); setEditingKey(null); await invalidateOrderQueries() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save row.') } finally { setBusy(false) }
  }
  async function remove(row: Record<string, unknown>) {
    if (!key || row[key] == null) return; setBusy(true); setError(null)
     try { await deleteMasterData(table, key, String(row[key]), user.role, source); setPendingDelete(null); await load(); await invalidateOrderQueries() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not remove row.') } finally { setBusy(false) }
  }
  async function invalidateOrderQueries() { await queryClient.invalidateQueries({ queryKey: ['orders', 'facets'] }); await queryClient.invalidateQueries({ queryKey: ['orders', 'list'] }); await queryClient.invalidateQueries({ queryKey: ['reference'] }) }
  function edit(row: Record<string, unknown>) { if (!key || row[key] == null) return; const editColumns = table === 'Utilizador' ? columns.filter((column) => !['upsize_ts', 'DT_User'].includes(column)) : inputColumns; setEditingKey(String(row[key])); setValues(Object.fromEntries(editColumns.map((column) => [column, row[column] == null ? '' : String(row[column])] ))); setFieldErrors({}) }

  return <>
    <div className="space-y-4"><details className="rounded-lg border border-border bg-surface p-4 shadow-sm"><summary className="cursor-pointer text-sm font-semibold">Reference tables</summary><p className="mt-1 text-xs text-foreground/60">Operational reference data maintained by the demo database.</p><div className="mt-3 grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="grid max-h-80 gap-1 overflow-y-auto rounded-md border border-border p-2 lg:max-h-[520px]">{masterDataTables.map(([label, name]) => <button key={name} type="button" onClick={() => { setTable(name); setSearch({}); setPage(0) }} className={`rounded px-3 py-2 text-left text-xs ${table === name ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-foreground/5'}`}>{label}<span className="mt-0.5 block text-[10px] text-foreground/50">dbo.{name}</span></button>)}</div>
      <div className="min-w-0 space-y-3">{error && <p role="alert" className="rounded bg-danger/10 p-2 text-xs text-danger">{error}</p>}<div className="flex flex-wrap items-center gap-2"><Badge tone="neutral">dbo.{table}</Badge>{key && <span className="text-xs text-foreground/50">Delete key: {key}</span>}<Button size="sm" variant="secondary" onClick={() => void load()} disabled={busy}><RefreshCw className="size-4" /> Refresh</Button></div>
         <div className="rounded-md border border-sky-200 bg-sky-50/50 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-sky-900"><Search className="size-4" />Search {table}{table === 'stck_Materiais' && <span className="font-normal text-sky-700">({filteredRows.length.toLocaleString()} matches)</span>}</div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{searchFields.map((column) => <label key={column} className="text-xs font-semibold text-sky-950">{column}<Input className="mt-1 border-sky-200 bg-white" placeholder={`Search ${column}`} value={search[column] ?? ''} onChange={(event) => { setSearch((current) => ({ ...current, [column]: event.target.value })); setPage(0) }} /></label>)}</div></div>
          <div className="rounded-md border border-border bg-surface p-3"><div className="mb-2 text-xs font-semibold">{editingKey == null ? 'Add row' : 'Edit row'}</div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{inputColumns.map((column) => <MaintenanceField key={column} column={column} table={table} value={values[column] ?? ''} error={fieldErrors[column]} linkedRows={linkedRows} required={editingKey == null && requiredField(table, column)} disabled={editingKey != null && table === 'Utilizador' && column === 'ID_User'} onChange={(value) => setValue(column, value)} />)}</div></div>
        <div className="flex gap-2"><Button size="sm" onClick={() => void save()} disabled={busy}><Plus className="size-4" />{editingKey == null ? 'Add row' : 'Save changes'}</Button>{editingKey != null && <Button size="sm" variant="secondary" onClick={() => { setEditingKey(null); setValues({}); setFieldErrors({}) }}>Cancel edit</Button>}</div>
          {result && <><div className="overflow-x-auto rounded border border-border"><table className="w-full text-left text-xs"><thead><tr>{columns.map((column) => <th key={column} className="whitespace-nowrap border-b border-border px-2 py-2 font-semibold">{column}</th>)}<th className="border-b border-border px-2 py-2">Actions</th></tr></thead><tbody>{paginatedRows.map((row, index) => <tr key={`${String(row[key] ?? 'row')}-${index}`}>{columns.map((column) => <td key={column} className="whitespace-nowrap border-b border-border px-2 py-2">{displayValue(table, column, row, linkedRows)}</td>)}<td className="whitespace-nowrap border-b border-border px-2 py-2"><Button size="sm" variant="ghost" onClick={() => edit(row)} disabled={busy}>Edit</Button><Button size="sm" variant="ghost" onClick={() => setPendingDelete(row)} disabled={busy}><Trash2 className="size-4 text-danger" /></Button></td></tr>)}</tbody></table></div>{table === 'stck_Materiais' && <div className="space-y-2 pt-2 text-xs text-foreground/60"><div className="text-center">Page {page + 1} of {pageCount} · Showing {paginatedRows.length.toLocaleString()} of {(Object.keys(search).some((column) => search[column]?.trim()) ? filteredRows.length : materialTotal).toLocaleString()} results</div><div className="flex items-center justify-between gap-2"><div className="flex shrink-0 items-center gap-1"><button type="button" className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs font-medium hover:bg-foreground/5 disabled:pointer-events-none disabled:opacity-50" disabled={page === 0 || busy} onClick={() => setPage(0)}>« 1</button><Button size="sm" variant="secondary" disabled={page === 0 || busy} onClick={() => setPage((current) => current - 1)}>Previous</Button></div><nav className="flex max-w-full flex-wrap justify-center gap-1" aria-label="Materials pages">{visiblePages.map((visiblePage) => <button key={visiblePage} type="button" aria-current={visiblePage === page ? 'page' : undefined} disabled={busy} onClick={() => setPage(visiblePage)} className={`inline-flex size-8 items-center justify-center rounded-md border text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${visiblePage === page ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-foreground hover:bg-foreground/5'}`}>{visiblePage + 1}</button>)}</nav><div className="flex shrink-0 items-center gap-1"><Button size="sm" variant="secondary" disabled={page >= pageCount - 1 || busy} onClick={() => setPage((current) => current + 1)}>Next</Button><button type="button" className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs font-medium hover:bg-foreground/5 disabled:pointer-events-none disabled:opacity-50" disabled={page >= pageCount - 1 || busy} onClick={() => setPage(pageCount - 1)}>{pageCount} »</button></div></div></div>}</>}
      </div></div></details></div>
    <ConfirmDialog open={pendingDelete !== null} title={`Remove ${table} row?`} description={`This will permanently remove ${String(pendingDelete?.[key ?? ''] ?? '')} from dbo.${table}.`} confirmLabel="Remove" destructive busy={busy} onClose={() => setPendingDelete(null)} onConfirm={() => pendingDelete && void remove(pendingDelete)} />
  </>
}

function MaintenanceField({ column, table, value, error, linkedRows, required = false, disabled = false, onChange }: { column: string; table: string; value: string; error?: string; linkedRows: Record<string, Record<string, unknown>[]>; required?: boolean; disabled?: boolean; onChange: (value: string) => void }) {
  const foreignKey = foreignKeyFor(table, column); const options = foreignKey ? linkedRows[foreignKey.table] ?? [] : []
  const label = table === 'Utilizador' ? ({ ID_User: 'Username pedido', User_Name: 'User Name', Read_Only: 'Read only', Admin: 'Admin' }[column] ?? column) : column
  return <label className="text-xs font-semibold">{label}{foreignKey ? <select required={required} disabled={disabled} className="mt-1 w-full rounded-md border border-border bg-surface p-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select {foreignKey.table}</option>{options.map((row, index) => <option key={`${String(row[foreignKey.key])}-${index}`} value={String(row[foreignKey.key])}>{String(row[foreignKey.label] ?? row[foreignKey.key] ?? '')}</option>)}</select> : booleanField(column) ? <select required={required} disabled={disabled} className="mt-1 w-full rounded-md border border-border bg-surface p-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{required ? 'Select' : 'Optional'}</option><option value="true">Yes</option><option value="false">No</option></select> : <Input required={required} disabled={disabled} className="mt-1" placeholder={placeholderFor(table, column)} value={value} onChange={(event) => onChange(event.target.value)} />}{error && <span className="text-[10px] font-normal text-danger">{error}</span>}</label>
}

function foreignKeysFor(table: string) { return FOREIGN_KEYS[table] ?? {} }
function foreignKeyFor(table: string, column: string) { return foreignKeysFor(table)[column] }
function displayValue(table: string, column: string, row: Record<string, unknown>, linkedRows: Record<string, Record<string, unknown>[]>) {
  const value = row[column]
  const foreignKey = foreignKeyFor(table, column)
  if (!foreignKey || value == null || value === '') return String(value ?? '')
  const linkedRow = (linkedRows[foreignKey.table] ?? []).find(
    (candidate) => String(candidate[foreignKey.key]) === String(value),
  )
  return String(linkedRow?.[foreignKey.label] ?? value)
}
function databaseValue(column: string, value: string): string | number | boolean | null { if (!value) return null; if (booleanField(column)) return value === 'true' || value === '1'; if (numericField(column)) return Number(value); return value }
function numericField(column: string) { return ['ID', 'ID_Grp_Report', 'ID_Produto', 'ID_Tp_Cliente', 'ID_Tp_Revenue', 'ID_Tp_Warranty', 'N_Anos', 'Reserve_Ano_p'].includes(column) }
function booleanField(column: string) { return ['Provisoria', 'Warranty', 'Read_Only', 'Admin', 'Cancelado'].includes(column) }
function requiredField(table: string, column: string) { if (table === 'Utilizador') return ['ID_User', 'User_Name', 'Read_Only', 'Admin'].includes(column); if (table === 'Area') return column === 'ID_Area'; if (table === 'Produto') return ['ID_Area', 'Produto', 'Produto_Cod'].includes(column); if (table === 'ServiceType' || table === 'ChargeCategory') return column === 'Desc'; if (table === 'Grp_Report') return column === 'Grp_Report'; if (table === 'Instrumento') return ['ID_Produto', 'Instrumento'].includes(column); if (table === 'Tipo') return ['ID_Tipo', 'ID_Grp_Report'].includes(column); return ['ID_Tipo', 'ID_Tp_Doc_FT', 'ID_Tp_Order', 'ID_Tp_Reconhecimento'].includes(column) || (table === 'Tp_Order' && column === 'Provisoria') }
function placeholderFor(table: string, column: string) { if (table === 'Produto' && column === 'Produto_Cod') return 'Product Code'; if (requiredField(table, column)) return 'Required'; if (numericField(column)) return 'Number'; return 'Optional' }
