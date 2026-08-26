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
import { Checkbox } from '@/components/ui/checkbox'
import {
  areaLabel,
  instrumentoLabel,
  orderTypeLabel,
  produtoLabel,
  revenueLabel,
  tipoLabel,
  warrantyLabel,
} from '@/features/orders/components/reference-labels'
import type { OrderSummary } from '@/domain/models/order'
import { formatOrderDate, formatPrice } from '@/utils/format'

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

  const columns: ColumnDef<OrderSummary>[] = [
    {
      accessorKey: 'ID_Order',
      header: 'ID',
      size: 70,
      minSize: 50,
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
      accessorKey: 'Negocio_Fechado',
      header: 'Deal closed',
      size: 90,
      minSize: 60,
      cell: ({ row }) => (
        <ReadOnlyFlagCell
          order={row.original}
          field="Negocio_Fechado"
          label="Deal closed"
        />
      ),
    },
    {
      accessorKey: 'DT_Order',
      header: 'Date',
      size: 110,
      minSize: 80,
      cell: ({ row }: CellContext<OrderSummary, unknown>) => (
        <span className="whitespace-nowrap">{formatOrderDate(row.original.DT_Order)}</span>
      ),
    },
    {
      accessorKey: 'Order_Factory',
      header: 'Factory',
      size: 80,
      minSize: 60,
      cell: ({ row }) => (
        <ReadOnlyFlagCell
          order={row.original}
          field="Order_Factory"
          label="Factory"
        />
      ),
    },
    {
      accessorKey: 'Kit',
      header: 'Kit',
      size: 70,
      minSize: 50,
      cell: ({ row }) => (
        <ReadOnlyFlagCell
          order={row.original}
          field="Kit"
          label="Kit"
        />
      ),
    },
    {
      accessorKey: 'ID_Tp_Order',
      header: 'Order type',
      size: 120,
      minSize: 80,
      cell: ({ row }: CellContext<OrderSummary, unknown>) =>
        orderTypeLabel(row.original.ID_Tp_Order) ?? '—',
    },
    {
      accessorKey: 'Encomenda_Cli_PHC',
      header: 'SAP Order',
      size: 120,
      minSize: 80,
      cell: ({ row }: CellContext<OrderSummary, unknown>) =>
        row.original.Encomenda_Cli_PHC ?? '—',
    },
    {
      accessorKey: 'Client_Name',
      header: 'Client',
      size: 160,
      minSize: 100,
      cell: ({ row }: CellContext<OrderSummary, unknown>) => row.original.Client_Name ?? '—',
    },
    {
      accessorKey: 'ID_Area',
      header: 'Area',
      size: 110,
      minSize: 70,
      cell: ({ row }: CellContext<OrderSummary, unknown>) => areaLabel(row.original.ID_Area) ?? '—',
    },
    {
      accessorKey: 'ID_Tipo',
      header: 'Type',
      size: 100,
      minSize: 70,
      cell: ({ row }: CellContext<OrderSummary, unknown>) => tipoLabel(row.original.ID_Tipo) ?? '—',
    },
    {
      accessorKey: 'ID_Produto',
      header: 'Product',
      size: 140,
      minSize: 80,
      cell: ({ row }: CellContext<OrderSummary, unknown>) =>
        produtoLabel(row.original.ID_Produto) ?? '—',
    },
    {
      accessorKey: 'ID_Instrumento',
      header: 'Instrument',
      size: 160,
      minSize: 90,
      cell: ({ row }: CellContext<OrderSummary, unknown>) =>
        instrumentoLabel(row.original.ID_Instrumento) ?? '—',
    },
    {
      accessorKey: 'Sell_Price',
      header: 'Sell price',
      size: 120,
      minSize: 80,
      cell: ({ row }: CellContext<OrderSummary, unknown>) => (
        <span className="tabular-nums">{formatPrice(row.original.Sell_Price)}</span>
      ),
    },
    {
      accessorKey: 'ID_Tp_Warranty',
      header: 'Warranty type',
      size: 120,
      minSize: 80,
      cell: ({ row }: CellContext<OrderSummary, unknown>) =>
        warrantyLabel(row.original.ID_Tp_Warranty) ?? '—',
    },
    {
      accessorKey: 'Warranty_Reserve',
      header: 'Warranty reserve',
      size: 130,
      minSize: 90,
      cell: ({ row }: CellContext<OrderSummary, unknown>) => (
        <span className="tabular-nums">{formatPrice(row.original.Warranty_Reserve)}</span>
      ),
    },
    {
      accessorKey: 'Warranty_DT_Inicio',
      header: 'Warranty start',
      size: 120,
      minSize: 80,
      cell: ({ row }: CellContext<OrderSummary, unknown>) => (
        <span className="whitespace-nowrap">
          {formatOrderDate(row.original.Warranty_DT_Inicio)}
        </span>
      ),
    },
    {
      accessorKey: 'Orc_Proposta',
      header: 'Budget ref',
      size: 130,
      minSize: 80,
      cell: ({ row }: CellContext<OrderSummary, unknown>) => row.original.Orc_Proposta ?? '—',
    },
    {
      accessorKey: 'PO_Cliente',
      header: 'Customer PO',
      size: 140,
      minSize: 80,
      cell: ({ row }: CellContext<OrderSummary, unknown>) => row.original.PO_Cliente ?? '—',
    },
    {
      accessorKey: 'ID_Tp_Revenue',
      header: 'Revenue type',
      size: 120,
      minSize: 80,
      cell: ({ row }: CellContext<OrderSummary, unknown>) =>
        revenueLabel(row.original.ID_Tp_Revenue) ?? '—',
    },
  ]

  const table = useReactTable<OrderSummary>({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  const clickable = Boolean(onRowClick)

  return (
    <div className="h-full overflow-auto rounded-lg border border-border">
      <table
        className="table-fixed border-collapse text-sm"
        style={{ width: table.getTotalSize() }}
        aria-label="Orders"
      >
        <thead className="sticky top-0 z-10 bg-surface">
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
                    style={{ width: header.getSize() }}
                    className="relative whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-foreground/60"
                  >
                    {header.isPlaceholder ? null : <SortHeader header={header} direction={direction} />}
                    {header.column.getCanResize() ? (
                      <ResizeHandle header={header} />
                    ) : null}
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
                <td key={cell.id} className="truncate px-3 py-2 text-foreground/80">
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

/** Read-only boolean flag checkbox rendered inside a grid cell. The list grid only
 *  displays these flags — editing happens on the detail page — so the checkbox is always
 *  disabled and never navigates the row. The accessible name carries the flag + order id so
 *  screen readers announce "Deal closed order 1001" etc. */
function ReadOnlyFlagCell({
  order,
  field,
  label,
}: {
  order: OrderSummary
  field: 'Negocio_Fechado' | 'Order_Factory' | 'Kit'
  label: string
}) {
  const checked = order[field] ?? false
  return (
    <Checkbox
      checked={checked}
      disabled
      aria-label={`${label} order ${order.ID_Order}`}
      onChange={() => {}}
    />
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
  const state =
    direction === 'asc' ? 'sorted ascending' : direction === 'desc' ? 'sorted descending' : 'not sorted'
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

/** Drag handle at the right edge of each header cell. TanStack manages the column sizing
 * state; this element just forwards mouse/touch events to `header.getResizeHandler()`. */
function ResizeHandle({ header }: { header: Header<OrderSummary, unknown> }) {
  const label = String(header.column.columnDef.header)
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none select-none bg-foreground/0 hover:bg-primary/40"
    />
  )
}