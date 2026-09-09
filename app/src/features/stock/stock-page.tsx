import { useEffect, useRef, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs } from '@/components/ui/tabs'
import { useAuth, useCurrentUser } from '@/app/providers/user-provider'
import {
  createStockMovement,
  fetchMasterData,
  fetchStock,
  fetchStockMovements,
  type SyncResult,
} from '@/features/administration/api/admin-api'

const stockColumns: Record<string, string> = {
  arm: 'Warehouse',
  arm_desc: 'Warehouse',
  ref: 'Ref',
  description: 'Material Description',
  mov_qt_sum: 'Qtt',
  price: 'Price',
  localizacao: 'Location',
}

export function StockPage() {
  const user = useCurrentUser()
  const { user: displayedUser } = useAuth()
  const [stock, setStock] = useState<SyncResult | null>(null)
  const [movements, setMovements] = useState<SyncResult | null>(null)
  const [filters, setFilters] = useState({ ref: '', warehouse: '', description: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [materials, setMaterials] = useState<Record<string, unknown>[]>([])
  const [materialSearch, setMaterialSearch] = useState('')
  const [warehouses, setWarehouses] = useState<Record<string, unknown>[]>([])
  const [warehouseTypes, setWarehouseTypes] = useState<string[]>([])
  const loadRequest = useRef(0)
  const [movement, setMovement] = useState({
    ref: '',
    id_arm: '',
    mov_date: new Date().toISOString().slice(0, 16),
    mov_description: '',
    mov_qt: '',
  })

  async function load(): Promise<boolean> {
    const requestId = ++loadRequest.current
    setBusy(true)
    setError(null)
    try {
      const [nextMovements, nextStock] = await Promise.all([
        fetchStockMovements(user.role),
        fetchStock(filters, user.role),
      ])
      if (requestId !== loadRequest.current) return false
      setMovements(nextMovements)
      setStock(nextStock)
      setWarehouseTypes((current) => {
        if (current.length > 0) return current
        return [...new Set(nextStock.rows.map((row) => String(row.arm_desc ?? '')).filter(Boolean))]
      })
      setMaterials((current) => {
        if (current.length > 0) return current
        const unique = new Map<string, Record<string, unknown>>()
        for (const row of nextStock.rows) {
          const ref = String(row.ref ?? '')
          if (ref && !unique.has(ref)) unique.set(ref, row)
        }
        return unique.size > 0 ? [...unique.values()] : current
      })
      return true
    } catch (reason) {
      if (requestId === loadRequest.current) {
        setError(reason instanceof Error ? reason.message : 'Unable to load stock.')
      }
      return false
    } finally {
      if (requestId === loadRequest.current) setBusy(false)
    }
  }
  async function openAdd() {
    setShowAdd(true)
    try {
      const warehouseRows = await fetchMasterData('stck_Armazens', user.role)
      setWarehouses(warehouseRows.rows)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load references.')
    }
  }
  async function addMovement() {
    setBusy(true)
    setError(null)
    try {
      await createStockMovement(
        {
          ref: movement.ref,
          id_arm: Number(movement.id_arm),
          mov_date: movement.mov_date,
          mov_description: movement.mov_description,
          mov_qt: Number(movement.mov_qt),
        },
        user.role,
      )
      const refreshed = await load()
      if (!refreshed) {
        throw new Error(
          'Movement recorded, but Stock and Material Transaction tables could not be refreshed.',
        )
      }
      setShowAdd(false)
      setMovement({
        ref: '',
        id_arm: '',
        mov_date: new Date().toISOString().slice(0, 16),
        mov_description: '',
        mov_qt: '',
      })
      setMaterialSearch('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add the movement.')
    } finally {
      setBusy(false)
    }
  }
  // The initial request and filter refresh share the same server-side query.
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.ref, filters.warehouse, filters.description, user.role])
  const selectedMaterial = materials.find((row) => String(row.ref) === movement.ref)
  const filteredMaterials = materials
    .filter((row) => {
      const query = materialSearch.trim().toLowerCase()
      if (!query) return false
      return [row.ref, row.description].some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(query),
      )
    })
    .slice(0, 50)
  const movementForm = showAdd && (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <h2 className="text-sm font-semibold">Add material movement</h2>
      {error && (
        <p role="alert" className="mt-2 rounded bg-danger/10 p-2 text-xs text-danger">
          {error}
        </p>
      )}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="text-xs font-semibold md:col-span-2">
          <label htmlFor="stock-material-search">Material reference or name</label>
          <Input
            id="stock-material-search"
            className="mt-1"
            placeholder="Search by reference or name"
            value={materialSearch}
            onChange={(e) => setMaterialSearch(e.target.value)}
          />
          <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-surface">
            {!materialSearch.trim() ? (
              <p className="p-2 text-xs font-normal text-foreground/60">
                Enter a reference or name to search.
              </p>
            ) : filteredMaterials.length === 0 ? (
              <p className="p-2 text-xs font-normal text-foreground/60">No materials found.</p>
            ) : (
              filteredMaterials.map((row, i) => {
                const ref = String(row.ref ?? '')
                const description = String(row.description ?? '')
                return (
                  <button
                    key={`${ref}-${i}`}
                    type="button"
                    className="block w-full border-b border-border px-2 py-1.5 text-left text-xs font-normal last:border-b-0 hover:bg-foreground/5"
                    onClick={() => {
                      setMovement({ ...movement, ref })
                      setMaterialSearch(`${ref.trim()} - ${description.trim()}`)
                    }}
                  >
                    <span className="font-semibold">{ref.trim()}</span>
                    {description.trim() ? ` - ${description.trim()}` : ''}
                  </button>
                )
              })
            )}
          </div>
        </div>
        <label className="text-xs font-semibold">
          Warehouse
          <select
            className="mt-1 w-full rounded-md border border-border bg-surface p-2 text-sm"
            value={movement.id_arm}
            onChange={(e) => setMovement({ ...movement, id_arm: e.target.value })}
          >
            <option value="">Select warehouse</option>
            {warehouses.map((row, i) => (
              <option key={i} value={String(row.id_arm)}>
                {String(row.arm)} · {String(row.arm_desc ?? '')}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-foreground/70">
          Material: <strong>{String(selectedMaterial?.description ?? 'Select a material')}</strong>
        </p>
        <label className="text-xs font-semibold">
          Transaction Date
          <Input
            className="mt-1"
            type="datetime-local"
            value={movement.mov_date}
            onChange={(e) => setMovement({ ...movement, mov_date: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold">
          Movement Description
          <Input
            className="mt-1"
            value={movement.mov_description}
            onChange={(e) => setMovement({ ...movement, mov_description: e.target.value })}
          />
        </label>
        <label className="text-xs font-semibold">
          Qtt
          <Input
            className="mt-1"
            type="number"
            step="any"
            placeholder="Ex.: 1 ou -1"
            value={movement.mov_qt}
            onChange={(e) => setMovement({ ...movement, mov_qt: e.target.value })}
          />
          <span className="mt-1 block text-[11px] font-normal text-foreground/60">
            Use a positive value to add or a negative value to remove.
          </span>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => void addMovement()}
          disabled={busy || !movement.ref || !movement.id_arm || !movement.mov_qt}
        >
          Record movement
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowAdd(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
  const table = (result: SyncResult | null, labels = stockColumns) =>
    result && (
      <div className="overflow-x-auto rounded border border-border">
        <table className="min-w-max w-full text-left text-xs">
          <thead>
            <tr>
              {result.columns.map((column) => (
                <th
                  key={column}
                  className="whitespace-nowrap border-b border-border px-3 py-2 font-semibold"
                >
                  {labels[column] ?? column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, index) => (
              <tr key={index}>
                {result.columns.map((column) => (
                  <td key={column} className="whitespace-nowrap border-b border-border px-3 py-2">
                    {row[column] == null ? '—' : String(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  return (
    <div>
      <PageHeader title="Stock" description="View stock and material movements." />
      <Tabs
        ariaLabel="Stock sections"
        tabs={[
          {
            id: 'stock',
            label: 'Stock',
            content: (
              <section className="space-y-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">Stock by warehouse</h2>
                     {displayedUser?.Admin && <p className="text-xs text-foreground/60">dbo.V_stck_Group</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void openAdd()}
                      disabled={user.role === 'viewer'}
                    >
                      <Plus className="size-4" /> Add Material
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void load()}
                      disabled={busy}
                    >
                      <RefreshCw className="size-4" /> Refresh
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3 md:justify-items-center">
                  <label className="w-full max-w-sm text-center text-xs font-semibold">
                    Ref
                    <Input
                      className="mt-1"
                      value={filters.ref}
                      onChange={(e) => setFilters({ ...filters, ref: e.target.value })}
                    />
                  </label>
                  <fieldset className="flex w-full max-w-sm flex-col items-center text-xs font-semibold">
                    <legend className="w-full text-center">Warehouse</legend>
                    <div className="mt-1 inline-flex min-h-9 w-fit max-w-full flex-wrap items-center justify-center gap-3 rounded-md border border-border bg-surface px-3 py-1.5">
                      {warehouseTypes.map((warehouse) => (
                        <label key={warehouse} className="flex items-center gap-1.5 font-normal">
                          <Checkbox
                            checked={filters.warehouse === warehouse}
                            aria-label={warehouse}
                            onChange={(e) =>
                              setFilters({
                                ...filters,
                                warehouse: e.target.checked ? warehouse : '',
                              })
                            }
                          />
                          {warehouse}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="w-full max-w-sm text-center text-xs font-semibold">
                    Desc. Material
                    <Input
                      className="mt-1"
                      value={filters.description}
                      onChange={(e) => setFilters({ ...filters, description: e.target.value })}
                    />
                  </label>
                </div>
                {movementForm}
                {table(stock) ?? (
                  <p className="rounded border border-dashed border-border p-6 text-center text-sm text-foreground/60">
                    A carregar stock...
                  </p>
                )}
              </section>
            ),
          },
          {
            id: 'movements',
            label: 'Material Transaction',
            content: (
              <section className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold">Material Transaction</h2>
                     {displayedUser?.Admin && <p className="text-xs text-foreground/60">dbo.V_stck_Mov_Materiais</p>}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => void load()} disabled={busy}>
                    <RefreshCw className="size-4" /> Refresh
                  </Button>
                </div>
                {table(movements, {
                  ref: 'Ref',
                  description: 'Material Description',
                  localizacao: 'Location',
                  id_arm: 'Warehouse ID',
                  arm: 'Warehouse',
                  arm_desc: 'Warehouse',
                  mov_date: 'Transaction Date',
                  mov_description: 'Movement Description',
                  mov_qt: 'Qtt',
                  mov_qt_sum: 'Cumulative Qtt',
                  id_MovStck: 'ID',
                })}
              </section>
            ),
          },
        ]}
      />
      {error && (
        <p role="alert" className="mt-3 rounded bg-danger/10 p-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
