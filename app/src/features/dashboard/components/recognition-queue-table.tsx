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
import { Badge } from '@/components/ui/badge'
import { cn } from '@/components/ui/cn'
import type { DashboardRecognitionQueueItem } from '@/domain/models/dashboard'
import { formatOrderDate, formatPrice } from '@/utils/format'

interface RecognitionQueueTableProps {
  data: DashboardRecognitionQueueItem[]
  /** Row-click handler; receives `row.idOrder`. Click is a no-op when `idOrder` is null
   *  (queue rows with no matching Order are read-only). */
  onRowClick?: (id: number) => void
}

/**
 * Full backlog table for dbo.[11-Reconhecimento-PorReconhecer] — the same row shape
 * the dashboard queue card shows, but rendered in a sortable TanStack grid so the
 * user can browse every order that still has positive remaining value. Used by the
 * dashboard's "View all" modal. Clicking a row navigates to `/orders/:id` so the
 * user can manage the order's recognition/invoicing.
 *
 * Defaults to `Valor por Reconhecer DESC` matching the SQL ORDER BY so the heaviest
 * exposures surface first. Columns mirror the queue's source columns
 * (`ID_Order`, `Enc PHC`, `Data Pedido`, `Cliente`, `Area`, `Produto`, `Tipo`,
 * `Preço de Venda`, `Valor Reconhecido`, `Valor por Reconhecer`, `Facturado`).
 */
export function RecognitionQueueTable({ data, onRowClick }: RecognitionQueueTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'remainingValue', desc: true },
  ])

  const columns: ColumnDef<DashboardRecognitionQueueItem>[] = [
    {
      accessorKey: 'idOrder',
      header: 'ID',
      size: 80,
      minSize: 60,
      cell: ({ row }: CellContext<DashboardRecognitionQueueItem, unknown>) => {
        const id = row.original.idOrder
        if (id === null) return '—'
        return (
          <Link
            to={`/orders/${id}`}
            aria-label={`View order ${id} details`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium hover:underline"
          >
            {id}
          </Link>
        )
      },
    },
    {
      accessorKey: 'encPhc',
      header: 'SAP Order',
      size: 130,
      minSize: 100,
      cell: ({ row }) => row.original.encPhc ?? '—',
    },
    {
      accessorKey: 'orderDate',
      header: 'Order date',
      size: 120,
      minSize: 100,
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{formatOrderDate(row.original.orderDate)}</span>
      ),
    },
    {
      accessorKey: 'client',
      header: 'Client',
      size: 220,
      minSize: 140,
      cell: ({ row }) => row.original.client ?? '—',
    },
    {
      accessorKey: 'area',
      header: 'Area',
      size: 100,
      minSize: 70,
      cell: ({ row }) => row.original.area ?? '—',
    },
    {
      accessorKey: 'product',
      header: 'Product',
      size: 150,
      minSize: 110,
      cell: ({ row }) => row.original.product ?? '—',
    },
    {
      accessorKey: 'type',
      header: 'Type',
      size: 130,
      minSize: 90,
      cell: ({ row }) => row.original.type ?? '—',
    },
    {
      accessorKey: 'sellPrice',
      header: 'Sell price',
      size: 120,
      minSize: 90,
      cell: ({ row }: CellContext<DashboardRecognitionQueueItem, unknown>) => (
        <span className="tabular-nums">{formatPrice(row.original.sellPrice)}</span>
      ),
    },
    {
      accessorKey: 'recognizedValue',
      header: 'Recognized',
      size: 130,
      minSize: 100,
      cell: ({ row }: CellContext<DashboardRecognitionQueueItem, unknown>) => (
        <span className="tabular-nums text-foreground/80">
          {formatPrice(row.original.recognizedValue)}
        </span>
      ),
    },
    {
      accessorKey: 'remainingValue',
      header: 'To recognize',
      size: 140,
      minSize: 110,
      cell: ({ row }: CellContext<DashboardRecognitionQueueItem, unknown>) => (
        <span className="tabular-nums font-semibold text-warning">
          {formatPrice(row.original.remainingValue)}
        </span>
      ),
    },
    {
      accessorKey: 'invoiced',
      header: 'Invoiced',
      size: 100,
      minSize: 80,
      cell: ({ row }) => (
        <Badge tone={row.original.invoiced ? 'success' : 'warning'}>
          {row.original.invoiced ? 'Yes' : 'No'}
        </Badge>
      ),
    },
  ]

  const table = useReactTable<DashboardRecognitionQueueItem>({
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
    <div className="overflow-x-auto overflow-y-auto rounded-lg border border-border">
      <table
        className="table-fixed border-collapse text-sm"
        style={{ width: table.getTotalSize() }}
        aria-label="To recognize"
      >
        <thead className="sticky top-0 z-10 bg-surface">
          {table.getHeaderGroups().map((hg: HeaderGroup<DashboardRecognitionQueueItem>) => (
            <tr key={hg.id}>
              {hg.headers.map((header: Header<DashboardRecognitionQueueItem, unknown>) => {
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
          {table.getRowModel().rows.map((row: Row<DashboardRecognitionQueueItem>) => {
            const id = row.original.idOrder
            const rowClickable = clickable && id !== null
            return (
              <tr
                key={row.id}
                onClick={rowClickable && onRowClick ? () => onRowClick(id) : undefined}
                className={cn(
                  'border-t border-border transition-colors hover:bg-foreground/[0.03]',
                  rowClickable && 'cursor-pointer',
                )}
              >
                {row.getVisibleCells().map((cell: Cell<DashboardRecognitionQueueItem, unknown>) => (
                  <td key={cell.id} className="truncate px-3 py-2 text-foreground/80">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SortHeader({
  header,
  direction,
}: {
  header: Header<DashboardRecognitionQueueItem, unknown>
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

function ResizeHandle({ header }: { header: Header<DashboardRecognitionQueueItem, unknown> }) {
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
