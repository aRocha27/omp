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
import { DealStatusBadge } from '@/features/orders/components/order-status-badge'
import { orderTypeLabel } from '@/features/orders/components/reference-labels'
import { formatOrderDate, formatPrice } from '@/utils/format'
import type { OrderSummary } from '@/domain/models/order'

const columns: ColumnDef<OrderSummary>[] = [
  {
    accessorKey: 'ID_Order',
    header: 'Order #',
    cell: ({ row }: CellContext<OrderSummary, unknown>) => (
      <Link
        to={`/orders/${row.original.ID_Order}`}
        aria-label={`View order ${row.original.ID_Order} details`}
        onClick={(e) => e.stopPropagation()}
        className="font-medium hover:underline"
      >
        {row.original.ID_Order}
      </Link>
    ),
  },
  {
    accessorKey: 'DT_Order',
    header: 'Date',
    cell: ({ row }: CellContext<OrderSummary, unknown>) => (
      <span className="whitespace-nowrap">{formatOrderDate(row.original.DT_Order)}</span>
    ),
  },
  {
    accessorKey: 'Order_Factory',
    header: 'Factory',
    cell: ({ row }: CellContext<OrderSummary, unknown>) => {
      const v = row.original.Order_Factory
      return v == null ? '—' : v ? 'Yes' : 'No'
    },
  },
  {
    accessorKey: 'Client_Name',
    header: 'Client',
    cell: ({ row }: CellContext<OrderSummary, unknown>) => row.original.Client_Name ?? '—',
  },
  {
    accessorKey: 'ID_Tp_Order',
    header: 'Type',
    cell: ({ row }: CellContext<OrderSummary, unknown>) => orderTypeLabel(row.original.ID_Tp_Order) ?? '—',
  },
  {
    id: 'price',
    accessorKey: 'Sell_Price',
    header: 'Sell Price',
    cell: ({ row }: CellContext<OrderSummary, unknown>) => (
      <span className="tabular-nums">{formatPrice(row.original.Sell_Price)}</span>
    ),
  },
  {
    accessorKey: 'Negocio_Fechado',
    header: 'Deal',
    cell: ({ row }: CellContext<OrderSummary, unknown>) =>
      <DealStatusBadge closed={row.original.Negocio_Fechado} />,
  },
  {
    accessorKey: 'Encomenda_Cli_PHC',
    header: 'PHC Ref',
    cell: ({ row }: CellContext<OrderSummary, unknown>) => row.original.Encomenda_Cli_PHC ?? '—',
  },
]

interface OrdersTableProps {
  data: OrderSummary[]
  /** Optional row-click handler; receives the row's `ID_Order`. */
  onRowClick?: (id: number) => void
}

export function OrdersTable({ data, onRowClick }: OrdersTableProps) {
  // Start sorted by Date descending so the header reflects the server's newest-first order
  // and the sort control is discoverable. Toggling a header flips asc <-> desc (no "clear"
  // middle state), so the table always has a defined order.
  const [sorting, setSorting] = useState<SortingState>([{ id: 'DT_Order', desc: true }])

  const table = useReactTable<OrderSummary>({
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
      <table className="w-full border-collapse text-sm" aria-label="Orders">
        <thead className="bg-foreground/5">
          {table.getHeaderGroups().map((hg: HeaderGroup<OrderSummary>) => (
            <tr key={hg.id}>
              {hg.headers.map((header: Header<OrderSummary, unknown>) => {
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
          {table.getRowModel().rows.map((row: Row<OrderSummary>) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row.original.ID_Order) : undefined}
              className={[
                'border-t border-border transition-colors hover:bg-foreground/[0.03]',
                clickable ? 'cursor-pointer' : '',
              ].join(' ')}
            >
              {row.getVisibleCells().map((cell: Cell<OrderSummary, unknown>) => (
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

/** Sortable column header: a button that toggles asc/desc with a directional indicator.
 * The visible label comes from the column def; the button's accessible name announces the
 * current sort state so screen-reader users know what clicking will do. */
function SortHeader({
  header,
  direction,
}: {
  header: Header<OrderSummary, unknown>
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