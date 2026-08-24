import { useMemo } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Cell,
  type ColumnDef,
  type Header,
  type HeaderGroup,
  type Row,
} from '@tanstack/react-table'
import { ClipboardList } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs } from '@/components/ui/tabs'
import type { SyncAllResult, SyncResult, SyncedTable } from '@/features/administration/api/admin-api'

export function SyncedOrdersPanel({ result }: { result: SyncResult }) {
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      result.columns.map((column) => ({
        id: column,
        header: column,
        accessorFn: (row) => row[column],
        cell: ({ getValue }) => formatRawValue(getValue()),
      })),
    [result.columns],
  )
  const content =
    result.rows.length === 0 ? (
      <EmptyState
        icon={ClipboardList}
        title="No rows returned"
        description="The selected orders table is empty, or this account cannot see any rows."
      />
    ) : (
      <RawOrdersTable columns={columns} rows={result.rows} />
    )

  return <Tabs ariaLabel="Synchronized data" tabs={[{ id: 'orders', label: 'Orders', content }]} />
}

export function SyncedTablesPanel({ result }: { result: SyncAllResult }) {
  const tabs = useMemo(
    () =>
      result.tables.map((table) => ({
        id: `${table.schema}.${table.name}`,
        label: `${table.name} (${table.rows.length})`,
        content: <TableContent table={table} />,
      })),
    [result.tables],
  )

  if (result.tables.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No tables returned"
        description="This account cannot see any tables, or the database is empty."
      />
    )
  }

  return <Tabs ariaLabel="Synchronized tables" tabs={tabs} />
}

function TableContent({ table }: { table: SyncedTable }) {
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      table.columns.map((column) => ({
        id: column,
        header: column,
        accessorFn: (row) => row[column],
        cell: ({ getValue }) => formatRawValue(getValue()),
      })),
    [table.columns],
  )
  if (table.rows.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No rows returned"
        description={`${table.schema}.${table.name} is empty, or this account cannot see any rows.`}
      />
    )
  }
  return <RawOrdersTable columns={columns} rows={table.rows} />
}

function RawOrdersTable({
  columns,
  rows,
}: {
  columns: ColumnDef<Record<string, unknown>>[]
  rows: Record<string, unknown>[]
}) {
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() })

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm" aria-label="Synced orders">
        <thead className="bg-foreground/5">
          {table.getHeaderGroups().map((headerGroup: HeaderGroup<Record<string, unknown>>) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header: Header<Record<string, unknown>, unknown>) => (
                <th
                  key={header.id}
                  scope="col"
                  className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/60"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row: Row<Record<string, unknown>>) => (
            <tr key={row.id} className="border-t border-border hover:bg-foreground/[0.03]">
              {row.getVisibleCells().map((cell: Cell<Record<string, unknown>, unknown>) => (
                <td
                  key={cell.id}
                  className="max-w-96 whitespace-nowrap px-3 py-2 text-foreground/80"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatRawValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value) || '—'
  return String(value)
}
