import { useEffect, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCurrentUser } from '@/app/providers/user-provider'
import {
  createMasterData,
  fetchMasterData,
  updateMasterData,
  type SyncResult,
} from '@/features/administration/api/admin-api'

const configs = {
  stck_Materiais: {
    label: 'Materials',
    key: 'ref',
    fields: ['ref', 'description', 'familia', 'price', 'localizacao'],
    filters: ['ref', 'description'],
  },
  stck_Armazens: {
    label: 'Warehouses',
    key: 'id_arm',
    fields: ['id_arm', 'arm', 'arm_desc'],
    filters: ['arm', 'arm_desc'],
  },
} as const
export function StockReferenceMaintenance() {
  const user = useCurrentUser()
  const [table, setTable] = useState<keyof typeof configs>('stck_Materiais')
  const [result, setResult] = useState<SyncResult | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState({ ref: '', description: '', arm: '', arm_desc: '' })
  const [error, setError] = useState<string | null>(null)
  const config = configs[table]
  async function load() {
    try {
      setResult(await fetchMasterData(table, user.role))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load reference table.')
    }
  }
  useEffect(() => {
    // Loading asynchronously avoids blocking the effect while synchronizing the table.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, user.role])
  const rows =
    result?.rows.filter((row) =>
      config.filters.every(
        (field) =>
          !filter[field].trim() ||
          String(row[field] ?? '')
            .toLowerCase()
            .includes(filter[field].toLowerCase()),
      ),
    ) ?? []
  async function save() {
    try {
      const payload = Object.fromEntries(
        config.fields.map((field) => [
          field,
          values[field]
            ? ['id_arm', 'price'].includes(field)
              ? Number(values[field])
              : values[field]
            : null,
        ]),
      )
      const saved = editing
        ? await updateMasterData(table, config.key, editing, payload, user.role)
        : await createMasterData(table, payload, user.role)
      setResult(saved)
      setValues({})
      setEditing(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save row.')
    }
  }
  return (
    <section className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Reference Tables</h2>
          <p className="text-xs text-foreground/60">Materials and warehouses.</p>
        </div>
        <div className="flex gap-2">
          {Object.entries(configs).map(([name, item]) => (
            <Button
              key={name}
              size="sm"
              variant={table === name ? 'primary' : 'secondary'}
              onClick={() => {
                setTable(name as keyof typeof configs)
                setValues({})
                setEditing(null)
              }}
            >
              {item.label}
            </Button>
          ))}
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded bg-danger/10 p-2 text-xs text-danger">
          {error}
        </p>
      )}
      <div className="grid gap-2 md:grid-cols-2">
        {config.filters.map((field) => (
          <label key={field} className="text-xs font-semibold">
            {field === 'description' ? 'Description' : field === 'arm_desc' ? 'Warehouse' : field}
            <Input
              className="mt-1"
              value={filter[field]}
              onChange={(e) => setFilter({ ...filter, [field]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {config.fields.map((field) => (
          <label key={field} className="text-xs font-semibold">
            {field}
            <Input
              className="mt-1"
              value={values[field] ?? ''}
              onChange={(e) => setValues({ ...values, [field]: e.target.value })}
              disabled={editing !== null && field === config.key}
            />
          </label>
        ))}
      </div>
      <Button size="sm" onClick={() => void save()}>
        <Plus className="size-4" />
        {editing ? 'Save changes' : 'Add'}
      </Button>
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-left text-xs">
          <thead>
            <tr>
              {config.fields.map((field) => (
                <th key={field} className="border-b border-border px-2 py-2">
                  {field}
                </th>
              ))}
              <th className="border-b border-border px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {config.fields.map((field) => (
                  <td key={field} className="border-b border-border px-2 py-2">
                    {String(row[field] ?? '')}
                  </td>
                ))}
                <td className="border-b border-border px-2 py-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(String(row[config.key]))
                      setValues(
                        Object.fromEntries(
                          config.fields.map((field) => [field, String(row[field] ?? '')]),
                        ),
                      )
                    }}
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
