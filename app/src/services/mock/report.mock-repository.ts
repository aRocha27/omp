import type { BacklogReportRow, YearlyBacklogReportRow } from '@/domain/models/report'
import type { BacklogReportFilters, ReportRepository } from '@/services/contracts/report.repository'
import { delay } from './_constants'
import { orders } from '@/fixtures/orders'

export class MockReportRepository implements ReportRepository {
  async backlog(_filters?: BacklogReportFilters): Promise<BacklogReportRow[]> {
    await delay(120)
    return orders.flatMap((order) => {
      const row: BacklogReportRow = {
        ano: new Date(order.DT_Order).getFullYear(), mes: new Date(order.DT_Order).getMonth() + 1,
        idOrder: order.ID_Order, idArea: order.ID_Area, area: order.Area_Label ?? null, idTipo: order.ID_Tipo,
        tipo: order.Tipo_Label ?? null, idGrpReport: null, grpReport: null, idProduto: order.ID_Produto,
        produto: order.Produto_Label ?? null, encomendaCliPHC: order.Encomenda_Cli_PHC, backlogStart: 0,
        nob: order.Sell_Price ?? 0, revenue: 0, backlogEnd: order.Sell_Price ?? 0,
      }
      return [row]
    })
  }

  async backlogToday(): Promise<BacklogReportRow[]> {
    const rows = await this.backlog()
    return rows.reduce<BacklogReportRow[]>((result, row) => {
      const existing = result.find((item) => item.ano === row.ano && item.area === row.area && item.tipo === row.tipo)
      if (existing) {
        existing.backlogStart += row.backlogStart; existing.nob += row.nob; existing.revenue += row.revenue; existing.backlogEnd += row.backlogEnd
      } else result.push({ ...row, mes: null, idOrder: null, idProduto: null, produto: null, encomendaCliPHC: null })
      return result
    }, [])
  }

  async yearlyToday(): Promise<YearlyBacklogReportRow[]> {
    const rows = await this.backlog()
    const byYear = new Map<number, YearlyBacklogReportRow>()
    for (const row of rows) {
      if (row.ano == null) continue
      const current = byYear.get(row.ano) ?? { ano: row.ano, backlogStart: 0, nob: 0, revenue: 0, backlogEnd: 0 }
      current.backlogStart += row.backlogStart
      current.nob += row.nob
      current.revenue += row.revenue
      current.backlogEnd += row.backlogEnd
      byYear.set(row.ano, current)
    }
    return [...byYear.values()].sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0))
  }
}
