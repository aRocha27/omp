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
import { Badge } from '@/components/ui/badge'
import { formatOrderDate, formatPrice } from '@/utils/format'
import type { OrderSummary } from '@/domain/models/order'

const columns: ColumnDef<OrderSummary>[] = [
  {
    accessorKey: 'DT_Order',
    header: 'Date',
    cell: ({ row }: CellContext<OrderSummary, unknown>) => (
      <span className="whitespace-nowrap">{formatOrderDate(row.original.DT_Order)}</span>
    ),
  },
  {
    accessorKey: 'ID_Order',
    header: 'Order #',
    cell: ({ row }: CellContext<OrderSummary, unknown>) => (
      <span className="font-medium">{row.original.ID_Order}</span>
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
      row.original.Negocio_Fechado ? <Badge tone="success">Closed</Badge> : <Badge tone="neutral">Open</Badge>,
  },
  {
    accessorKey: 'Encomenda_Cli_PHC',
    header: 'PHC Ref',
    cell: ({ row }: CellContext<OrderSummary, unknown>) => row.original.Encomenda_Cli_PHC ?? '—',
  },
]

export function OrdersTable({ data }: { data: OrderSummary[] }) {
  const table = useReactTable<OrderSummary>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-foreground/5">
          {table.getHeaderGroups().map((hg: HeaderGroup<OrderSummary>) => (
            <tr key={hg.id}>
              {hg.headers.map((header: Header<OrderSummary, unknown>) => (
                <th
                  key={header.id}
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
              className="border-t border-border transition-colors hover:bg-foreground/[0.03]"
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