import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import type { OrderSummary } from '@/domain/models/order'
import {
  areaLabel,
  orderTypeLabel,
  produtoLabel,
} from '@/features/orders/components/reference-labels'
import { formatOrderDate, formatPrice } from '@/utils/format'

interface DashboardRecentOrdersTableProps {
  rows: OrderSummary[]
}

export function DashboardRecentOrdersTable({ rows }: DashboardRecentOrdersTableProps) {
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Recent orders</h3>
          <p className="mt-1 text-xs text-foreground/60">Newest orders from the live order list.</p>
        </div>
        <span className="text-xs text-foreground/50">{rows.length} shown</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-background/80 text-[11px] uppercase tracking-wide text-foreground/55">
            <tr>
              <th className="px-3 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Area</th>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Sell price</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-foreground/60">
                  No recent orders were returned.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.ID_Order} className="border-t border-border/70">
                  <td className="px-3 py-3 font-medium text-primary">
                    <Link to={`/orders/${row.ID_Order}`} className="hover:underline">
                      {row.ID_Order}
                    </Link>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-foreground/75">{formatOrderDate(row.DT_Order)}</td>
                  <td className="px-3 py-3 text-foreground">{row.Client_Name ?? '—'}</td>
                  <td className="px-3 py-3 text-foreground/75">{areaLabel(row.ID_Area) ?? '—'}</td>
                  <td className="px-3 py-3 text-foreground/75">{produtoLabel(row.ID_Produto) ?? orderTypeLabel(row.ID_Tp_Order) ?? '—'}</td>
                  <td className="px-3 py-3 tabular-nums text-foreground">{formatPrice(row.Sell_Price)}</td>
                  <td className="px-3 py-3">
                    {row.Negocio_Fechado ? (
                      <Badge tone="success">Closed</Badge>
                    ) : row.Provisoria ? (
                      <Badge tone="warning">Provisional</Badge>
                    ) : (
                      <Badge>Open</Badge>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
