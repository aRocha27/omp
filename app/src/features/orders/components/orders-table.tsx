import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Cell,
  type CellContext,
  type ColumnDef,
  type Header,
  type HeaderGroup,
  type Row,
} from '@tanstack/react-table'
import { DealStatusBadge } from '@/features/orders/components/order-status-badge'
import { formatOrderDate, formatPrice } from '@/utils/format'
import type { OrderSummary } from '@/domain/models/order'

const columns: ColumnDef<OrderSummary>[] = [
  {
    accessorKey: 'ID_Order',
    header: 'Order #',
    cell: ({ row }: CellContext<OrderSummary, unknown>) => (
      <span className="font-medium">{row.original.ID_Order}</span>
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
    cell: ({ row }: CellContext<OrderSummary, unknown>) => row.original.ID_Tp_Order ?? '—',
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
  const table = useReactTable<OrderSummary>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })
  const clickable = Boolean(onRowClick)

  const handleKeyDown = (row: Row<OrderSummary>, e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (!onRowClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRowClick(row.original.ID_Order)
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm" aria-label="Orders">
        <thead className="bg-foreground/5">
          {table.getHeaderGroups().map((hg: HeaderGroup<OrderSummary>) => (
            <tr key={hg.id}>
              {hg.headers.map((header: Header<OrderSummary, unknown>) => (
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
          {table.getRowModel().rows.map((row: Row<OrderSummary>) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row.original.ID_Order) : undefined}
              onKeyDown={onRowClick ? (e) => handleKeyDown(row, e) : undefined}
              tabIndex={clickable ? 0 : undefined}
              aria-label={clickable ? `View order ${row.original.ID_Order} details` : undefined}
              className={[
                'border-t border-border transition-colors hover:bg-foreground/[0.03]',
                clickable ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground/30' : '',
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