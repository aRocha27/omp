import { Database } from 'lucide-react'
import { Select } from '@/components/ui/select'
import type { DatabaseTable } from '@/features/administration/api/admin-api'

interface TablesPickerProps {
  tables: DatabaseTable[]
  selected: DatabaseTable | null
  onChange: (table: DatabaseTable | null) => void
}

export function TablesPicker({ tables, selected, onChange }: TablesPickerProps) {
  const selectedIndex = selected
    ? tables.findIndex((table) => table.schema === selected.schema && table.name === selected.name)
    : -1

  return (
    <div className="rounded-lg border border-border bg-surface-muted p-4">
      <div className="mb-3 flex items-center gap-2">
        <Database className="size-4 text-primary" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Orders source table</h3>
          <p className="text-xs text-foreground/60">
            {tables.length} table{tables.length === 1 ? '' : 's'} and view
            {tables.length === 1 ? '' : 's'} available.
          </p>
        </div>
      </div>

      <label
        htmlFor="administration-orders-table"
        className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-foreground/50"
      >
        Orders table
      </label>
      <Select
        id="administration-orders-table"
        value={selectedIndex < 0 ? '' : String(selectedIndex)}
        onChange={(event) => {
          const index = Number(event.target.value)
          onChange(Number.isInteger(index) && tables[index] ? tables[index] : null)
        }}
      >
        <option value="">Select a table or view</option>
        {tables.map((table, index) => (
          <option key={`${table.schema}.${table.name}`} value={String(index)}>
            {table.schema}.{table.name} · {table.type}
          </option>
        ))}
      </Select>
    </div>
  )
}
