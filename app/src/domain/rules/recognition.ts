/**
 * Revenue recognition capacity rules.
 *
 * Implements ONLY the formulas confirmed in AGENT.md §14 "Revenue recognition
 * workflow". The legacy Access form `Form_Reconhecimento_Sub.cls` splits each
 * order's recognition into two sides and refuses to let either side's running
 * total exceed its allowed amount.
 *
 * Key point (verified against AGENT.md §14 "Recognition categories" and the
 * live `dbo.Tp_Reconhecimento` data): the discriminator between the two sides
 * is the recognition record's `ID_Tp_Reconhecimento` field, where `"W"`
 * (Warranty) and `"WP"` (Warranty Parcial) mark the warranty side and any other
 * value (CM/P/T) marks the instrument / non-warranty side. This is NOT the
 * order's `ID_Tp_Warranty` field — that field classifies the order's warranty
 * type and is a separate lookup (`tbl_Tp_Warranty`). Do not conflate the two.
 */
import type { Order } from '@/domain/models/order'
import type { Reconhecimento } from '@/domain/models/reconhecimento'

/**
 * Recognition type codes that mark a recognition record as the warranty side.
 *
 * Source: AGENT.md §14 "Recognition categories" + live `dbo.Tp_Reconhecimento`:
 * ```text
 * ID_Tp_Reconhecimento IN ("W", "WP")
 * ```
 */
export const WARRANTY_RECOGNITION_TYPES = ['W', 'WP'] as const

/**
 * Back-compat single-code alias. Kept so existing imports compile; new code
 * should use {@link isWarrantyRecognition} / {@link WARRANTY_RECOGNITION_TYPES}.
 */
export const WARRANTY_RECOGNITION_TYPE = 'W'

/** True when a recognition type code belongs to the warranty side (W or WP). */
export function isWarrantyRecognition(code: string | null | undefined): boolean {
  return code === 'W' || code === 'WP'
}

/** A recognition capacity value, in the same unit as `Sell_Price` / `Warranty_Reserve`. */
export type RecognitionCapacity = number

/**
 * Inputs required to compute recognition capacity for a single order/side.
 *
 * `Sell_Price` and `Warranty_Reserve` come from the {@link Order}. The
 * discriminator `ID_Tp_Reconhecimento` belongs to the recognition record being
 * entered (AGENT.md §14 "Known visible fields"), not the order — it is taken
 * here as a plain string so this module stays free of the recognition-record
 * model.
 */
export interface RecognitionCapacityInput
  extends Pick<Order, 'Sell_Price' | 'Warranty_Reserve'> {
  /** Runtime Tipo.Warranty flag. Omitted only by legacy/unit-test callers. */
  Tipo_Warranty?: boolean | null
  /**
   * Recognition record type code (legacy `Reconhecimento.ID_Tp_Reconhecimento`).
   * `"W"` → warranty side; any other non-null value → non-warranty side.
   */
  ID_Tp_Reconhecimento: string | null
}

/**
 * Result of checking whether a new recognition amount may be recorded.
 */
export interface RecognitionCheckResult {
  /** True when the amount fits within the remaining capacity. */
  ok: boolean
  /**
   * Remaining capacity after accepting `amount`, i.e.
   * `capacity - alreadyRecognized - amount`. When `ok` is false this is still
   * computed (and will be negative when the amount itself exceeds the
   * remaining headroom) so callers can surface "you overshot by X". When the
   * capacity cannot be computed (null inputs) `ok` is false and `remaining`
   * is `null`.
   */
  remaining: number | null
}

/**
 * Compute the recognition capacity for one side of an order.
 *
 * Rules (AGENT.md §14 "Confirmed formulas"):
 * - Warranty side (`ID_Tp_Reconhecimento === "W"`): capacity = `Warranty_Reserve`.
 * - Non-warranty side (`ID_Tp_Reconhecimento` is any other non-null value):
 *   capacity = `Sell_Price - Warranty_Reserve`.
 *
 * Returns `null` when any required input is `null`. The legacy form resets
 * `Valor_Reconhecimento` to `Null` rather than coercing, so this function
 * never throws and never coerces missing values to 0.
 */
function effectiveWarrantyReserve(
  order: Pick<Order, 'Warranty_Reserve'> & Partial<Pick<Order, 'Tipo_Warranty'>>,
): number | null {
  // Full Order values always carry Tipo_Warranty. Callers that omit it retain the
  // legacy utility behavior so existing pure-rule call sites remain compatible.
  if (order.Tipo_Warranty !== undefined && order.Tipo_Warranty !== true) return 0
  return order.Warranty_Reserve
}

export function recognitionCapacity(
  input: RecognitionCapacityInput,
): RecognitionCapacity | null {
  const { Sell_Price, ID_Tp_Reconhecimento } = input
  const warrantyReserve = effectiveWarrantyReserve(input)

  if (ID_Tp_Reconhecimento === null) return null
  if (warrantyReserve === null) return null

  if (isWarrantyRecognition(ID_Tp_Reconhecimento)) {
    // AGENT.md §14 "Warranty maximum": Warranty_Reserve. Both "W" (full) and
    // "WP" (partial) draw from the warranty bucket (live `dbo.Tp_Reconhecimento`).
    return warrantyReserve
  }

  if (Sell_Price === null) return null

  // AGENT.md §14 "Non-warranty maximum": Sell_Price - Warranty_Reserve
  return Sell_Price - warrantyReserve
}

/**
 * Check whether a new recognition `amount` may be recorded without exceeding
 * the allowed total for its side.
 *
 * AGENT.md §14 "Validation": if a newly entered recognition value causes the
 * applicable total (already-recognized + new amount) to exceed its allowed
 * amount, the entry is rejected (the legacy form resets
 * `Valor_Reconhecimento` to `Null` and recalculates totals).
 *
 * `alreadyRecognized` is the sum of existing `Valor_Reconhecimento` rows for
 * the same order and same side (warranty vs non-warranty) as of "today" — see
 * AGENT.md §14 "Current ... backlog in the active update handlers". Pass 0 for
 * a brand-new order.
 *
 * Returns `{ ok: false, remaining: null }` when the capacity cannot be
 * computed (null `Sell_Price` / `Warranty_Reserve` / `ID_Tp_Reconhecimento`),
 * matching the legacy "reset to Null" behaviour.
 */
export function canRecognize(
  input: RecognitionCapacityInput,
  alreadyRecognized: number,
  amount: number,
): RecognitionCheckResult {
  const capacity = recognitionCapacity(input)
  if (capacity === null) {
    return { ok: false, remaining: null }
  }

  const remaining = capacity - alreadyRecognized - amount
  return { ok: remaining >= 0, remaining }
}

/**
 * Revenue totals derived from an order and its recognition rows.
 *
 * Splits the running `Valor_Reconhecimento` sum into instrument (non-warranty)
 * and warranty (W/WP) sides and computes the "por reconhecer" remainders against
 * the order's capacities. The instrument capacity is `Sell_Price − Warranty_Reserve`
 * (the corrected formula — the old UI omitted the `− Warranty_Reserve` term); the
 * warranty capacity is `Warranty_Reserve`. Both capacities clamp at 0 when a
 * component is null/missing rather than coercing to a negative number.
 *
 * Returned in the same unit as `Sell_Price` / `Valor_Reconhecimento` (money).
 */
export interface RecognitionTotals {
  /** Σ Valor_Reconhecimento for non-warranty rows (instrument side). */
  instrumentReconhecido: number
  /**
   * `(Sell_Price − Warranty_Reserve) − instrumentReconhecido`, clamped at 0.
   * This is the corrected "Instrumento por Reconhecer" (req 9).
   */
  instrumentPorReconhecer: number
  /** Σ Valor_Reconhecimento for W/WP rows (warranty side). */
  warrantyReconhecido: number
  /** `Warranty_Reserve − warrantyReconhecido`, clamped at 0. */
  warrantyPorReconhecer: number
  /** Σ Valor_Reconhecimento for all rows. */
  totalReconhecido: number
}

/**
 * Sum a recognition row's value into the right bucket. Rows whose type is W/WP
 * count toward the warranty side; everything else counts toward the instrument
 * side. A null/undefined value is treated as 0 (consistent with `canRecognize`,
 * which never coerces capacity but does add amounts).
 */
function sumRecognition(
  recos: Array<Pick<Reconhecimento, 'ID_Tp_Reconhecimento' | 'Valor_Reconhecimento'>>,
): { instrument: number; warranty: number } {
  let instrument = 0
  let warranty = 0
  for (const row of recos) {
    const value = row.Valor_Reconhecimento ?? 0
    if (isWarrantyRecognition(row.ID_Tp_Reconhecimento)) {
      warranty += value
    } else {
      instrument += value
    }
  }
  return { instrument, warranty }
}

/**
 * Compute the Revenue card totals for an order from its recognition rows.
 *
 * Capacities are derived with null-safe clamping: a null `Sell_Price` or
 * `Warranty_Reserve` is treated as 0, so a half-filled order degrades to a 0
 * capacity for the missing side rather than a negative "por reconhecer".
 */
export function recognitionTotals(
  order: Pick<Order, 'Sell_Price' | 'Warranty_Reserve'> &
    Partial<Pick<Order, 'Tipo_Warranty'>>,
  recos: Array<Pick<Reconhecimento, 'ID_Tp_Reconhecimento' | 'Valor_Reconhecimento'>>,
): RecognitionTotals {
  const sellPrice = order.Sell_Price ?? 0
  const warrantyReserve = effectiveWarrantyReserve(order) ?? 0
  const { instrument: instrumentReconhecido, warranty: warrantyReconhecido } = sumRecognition(recos)

  const instrumentCapacity = sellPrice - warrantyReserve
  const instrumentPorReconhecer = Math.max(0, instrumentCapacity - instrumentReconhecido)
  const warrantyPorReconhecer = Math.max(0, warrantyReserve - warrantyReconhecido)

  return {
    instrumentReconhecido,
    instrumentPorReconhecer,
    warrantyReconhecido,
    warrantyPorReconhecer,
    totalReconhecido: instrumentReconhecido + warrantyReconhecido,
  }
}

/**
 * Recognition row state, date-dependent (req 3).
 *
 * A row is "reconhecido" once its recognition date is on or before today (UTC
 * day compare), and "por-reconhecer" when it falls in the future. A null date
 * is treated as "por-reconhecer" (no recognition has happened yet).
 */
export type ReconhecimentoEstado = 'reconhecido' | 'por-reconhecer'

/**
 * Decide a recognition row's estado from its `DT_Reconhecimento`.
 *
 * Comparison is by UTC calendar day: a row dated today counts as reconhecido.
 * Pass `today` for deterministic tests; defaults to the current date.
 */
export function reconhecimentoEstado(
  row: { DT_Reconhecimento: string | null },
  today: Date = new Date(),
): ReconhecimentoEstado {
  if (row.DT_Reconhecimento === null) return 'por-reconhecer'
  const reconDate = new Date(row.DT_Reconhecimento)
  if (Number.isNaN(reconDate.getTime())) return 'por-reconhecer'
  // Compare UTC midnight so a row dated "today" in any timezone still matches.
  const reconDay = Date.UTC(reconDate.getUTCFullYear(), reconDate.getUTCMonth(), reconDate.getUTCDate())
  const todayDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return reconDay <= todayDay ? 'reconhecido' : 'por-reconhecer'
}