import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Cell,
  type CellContext,
  type ColumnDef,
  type Header,
  type HeaderGroup,
  type Row,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { tpClienteLabel } from '@/features/orders/components/reference-labels'
import type { ClientSummary } from '@/domain/models/client'

const columns: ColumnDef<ClientSummary>[] = [
  {
    accessorKey: 'nome',
    header: 'Client',
    cell: ({ row }: CellContext<ClientSummary, unknown>) => {
      const name = row.original.nome ?? '—'
      return (
        <Link
          to={`/clients/${row.original.ID_Cliente}`}
          aria-label={`View client ${row.original.nome ?? row.original.ID_Cliente} details`}
          onClick={(e) => e.stopPropagation()}
          className="font-medium hover:underline"
        >
          {name}
        </Link>
      )
    },
  },
  {
    accessorKey: 'ID_Tp_Cliente',
    header: 'Type',
    cell: ({ row }: CellContext<ClientSummary, unknown>) =>
      tpClienteLabel(row.original.ID_Tp_Cliente) ?? '—',
  },
  {
    accessorKey: 'ncont',
    header: 'Tax',
    cell: ({ row }: CellContext<ClientSummary, unknown>) => row.original.ncont ?? '—',
  },
  {
    accessorKey: 'telefone',
    header: 'Phone',
    cell: ({ row }: CellContext<ClientSummary, unknown>) => row.original.telefone ?? '—',
  },
  {
    accessorKey: 'local',
    header: 'Location',
    cell: ({ row }: CellContext<ClientSummary, unknown>) => row.original.local ?? '—',
  },
]

interface ClientsTableProps {
  data: ClientSummary[]
  /** Optional row-click handler; receives the row's `ID_Cliente`. */
  onRowClick?: (id: number) => void
}

export function ClientsTable({ data, onRowClick }: ClientsTableProps) {
  // Start sorted by Client (nome) ascending — matches the backend's default order
  // and keeps the sort control discoverable. Toggling a header flips asc <-> desc.
  const [sorting, setSorting] = useState<SortingState>([{ id: 'nome', desc: false }])

  const table = useReactTable<ClientSummary>({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  const clickable = Boolean(onRowClick)

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm" aria-label="Clients">
        <thead className="bg-foreground/5">
          {table.getHeaderGroups().map((hg: HeaderGroup<ClientSummary>) => (
            <tr key={hg.id}>
              {hg.headers.map((header: Header<ClientSummary, unknown>) => {
                const direction = header.column.getIsSorted()
                const ariaSort =
                  direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={ariaSort}
                    className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/60"
                  >
                    {header.isPlaceholder ? null : <SortHeader header={header} direction={direction} />}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row: Row<ClientSummary>) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row.original.ID_Cliente) : undefined}
              className={[
                'border-t border-border transition-colors hover:bg-foreground/[0.03]',
                clickable ? 'cursor-pointer' : '',
              ].join(' ')}
            >
              {row.getVisibleCells().map((cell: Cell<ClientSummary, unknown>) => (
                <td key={cell.id} className="px-3 py-2 text-foreground/80">
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

/** Sortable column header — mirrors OrdersTable's SortHeader (accessible name
 *  announces the current sort state so screen-reader users know what clicking does). */
function SortHeader({
  header,
  direction,
}: {
  header: Header<ClientSummary, unknown>
  direction: false | 'asc' | 'desc'
}) {
  const label = String(header.column.columnDef.header)
  const state = direction === 'asc' ? 'sorted ascending' : direction === 'desc' ? 'sorted descending' : 'not sorted'
  return (
    <button
      type="button"
      onClick={header.column.getToggleSortingHandler()}
      className="group inline-flex items-center gap-1 text-foreground/60 transition-colors hover:text-foreground"
      aria-label={`${label}, ${state}. Activate to sort ${direction === 'asc' ? 'descending' : 'ascending'}.`}
    >
      <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
      <SortIcon direction={direction} />
    </button>
  )
}

function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') return <ArrowUp className="size-3.5" aria-hidden />
  if (direction === 'desc') return <ArrowDown className="size-3.5" aria-hidden />
  return <ChevronsUpDown className="size-3.5 opacity-40" aria-hidden />
}