/**
 * Recognition propagation rules (req 10 & 12).
 *
 * Pure functions that plan the monthly recognition lines the "Propagar garantia"
 * and "Propagar contrato" buttons generate. Kept free of React and of any
 * repository so they can be unit-tested with literals (TDD) and reused by both
 * the mock and HTTP repositories — the same math must drive both.
 *
 * Warranty propagation (req 10, only when `Tipo.Warranty` is true):
 *   meses = (N_Anos − 1) × 12        — 1-year warranty → 0 lines
 *   start = Warranty_DT_Inicio + 12 months (first of month)
 *   mensal = Warranty_Reserve / meses
 *   type = "WP" (Warranty Parcial)
 *
 * Maintenance Contract propagation (req 12, only when `ID_Tipo === "CM"`):
 *   meses = years × 12
 *   mensal = Sell_Price / meses
 *   start = startDate (first of month)
 *   catch-up = parcelas vencidas usam recognitionDate (first of month)
 *   type = "CM" (C Manut)
 *
 * Dates are emitted as ISO 8601 UTC on the first of each month. Values preserve
 * SQL Server `money` precision (four decimal places).
 */
import type { Order } from '@/domain/models/order'

/** One planned recognition line. */
export interface PropagationLine {
  /** Recognition type code ("WP" for warranty, "CM" for maintenance). */
  type: string
  /** Recognition date — ISO 8601 UTC, first of the month. */
  date: string
  /** Recognition value (SQL money, up to 4 decimals). */
  value: number
}

/** Fields read from the order for warranty propagation. */
export type WarrantyPropagationOrder = Pick<
  Order,
  'Tipo_Warranty' | 'ID_Tp_Warranty' | 'Warranty_Reserve' | 'Warranty_DT_Inicio'
>

/** Fields read from the order for maintenance propagation. */
export type MaintenancePropagationOrder = Pick<Order, 'ID_Tipo' | 'Sell_Price'>

/**
 * Number of warranty years for an order. Mirrors the live `dbo.Tp_Warranty`
 * mapping where `ID_Tp_Warranty` 1/2/3 → `N_Anos` 1/2/3. Falls back to 1
 * year when the order carries no warranty type.
 */
export function warrantyYears(idTpWarranty: number | null): number {
  if (idTpWarranty === null) return 1
  return idTpWarranty >= 1 ? idTpWarranty : 1
}

/**
 * Plan the warranty (WP) recognition lines for an order. Returns an empty array
 * when there is nothing to propagate: non-warranty order kind, missing start
 * date, missing/non-positive reserve, or a 1-year warranty (meses = 0).
 */
export function planWarrantyPropagation(order: WarrantyPropagationOrder): PropagationLine[] {
  if (!order.Tipo_Warranty) return []
  if (order.Warranty_DT_Inicio === null) return []
  const reserve = order.Warranty_Reserve
  if (reserve === null || reserve <= 0) return []

  const meses = (warrantyYears(order.ID_Tp_Warranty) - 1) * 12
  if (meses <= 0) return []

  const values = allocateMoney(reserve, meses)
  const start = addMonths(firstOfMonth(new Date(order.Warranty_DT_Inicio)), 12)
  return values.map((value, i) => ({
    type: 'WP',
    date: addMonths(start, i).toISOString(),
    value,
  }))
}

/**
 * Plan the maintenance-contract (CM) recognition lines for an order. Returns an
 * empty array for a non-CM order or a non-positive Sell_Price. Throws when
 * `startDate`/`years`/`recognitionDate` are missing or invalid — these come from
 * the propagation dialog and are required for a CM order.
 */
export function planMaintenancePropagation(
  order: MaintenancePropagationOrder,
  startDate: string | undefined,
  years: number | undefined,
  recognitionDate: string | undefined,
): PropagationLine[] {
  if (order.ID_Tipo !== 'CM') return []
  if (order.Sell_Price === null || order.Sell_Price <= 0) return []
  if (
    startDate === undefined ||
    recognitionDate === undefined ||
    years === undefined ||
    !Number.isInteger(years) ||
    years < 1 ||
    years > 100
  ) {
    throw new Error(
      'Contract start, recognition date and a whole number of years between 1 and 100 are required.',
    )
  }
  const startDateValue = new Date(startDate)
  if (Number.isNaN(startDateValue.getTime())) {
    throw new Error('Contract start date is invalid.')
  }
  const recognitionDateValue = new Date(recognitionDate)
  if (Number.isNaN(recognitionDateValue.getTime())) {
    throw new Error('Recognition date is invalid.')
  }

  const months = years * 12
  const values = allocateMoney(order.Sell_Price, months)
  const contractStart = firstOfMonth(startDateValue)
  const recognitionMonth = firstOfMonth(recognitionDateValue)
  return values.map((value, i) => {
    const scheduled = addMonths(contractStart, i)
    return {
      type: 'CM',
      date:
        scheduled.getTime() < recognitionMonth.getTime()
          ? recognitionMonth.toISOString()
          : scheduled.toISOString(),
      value,
    }
  })
}

/**
 * Split a total into SQL-money units while preserving the exact four-decimal total.
 * Any remainder is distributed one 0.0001 unit at a time over the earliest months.
 */
function allocateMoney(total: number, count: number): number[] {
  const totalUnits = Math.round(total * 10_000)
  const baseUnits = Math.floor(totalUnits / count)
  const remainder = totalUnits - baseUnits * count
  return Array.from(
    { length: count },
    (_, index) => (baseUnits + (index < remainder ? 1 : 0)) / 10_000,
  )
}

/** First day of the month for `date` (UTC). */
function firstOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

/** Add `n` calendar months to a UTC date, landing on the first of the month. */
function addMonths(date: Date, n: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1))
}
