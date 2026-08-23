/**
 * Revenue recognition capacity rules.
 *
 * Implements ONLY the formulas confirmed in AGENT.md §14 "Revenue recognition
 * workflow". The legacy Access form `Form_Reconhecimento_Sub.cls` splits each
 * order's recognition into two sides and refuses to let either side's running
 * total exceed its allowed amount.
 *
 * Key point (verified against AGENT.md §14 "Recognition categories"): the
 * discriminator between the two sides is the recognition record's
 * `ID_Tp_Reconhecimento` field, where the literal `"W"` marks the warranty
 * side and any other value marks the instrument / non-warranty side. This is
 * NOT the order's `ID_Tp_Warranty` field — that field classifies the order's
 * warranty type and is a separate lookup (`tbl_Tp_Warranty`). Do not conflate
 * the two.
 */
import type { Order } from '@/domain/models/order'

/**
 * Recognition type code that marks a recognition record as the warranty side.
 *
 * Source: AGENT.md §14 "Recognition categories":
 * ```text
 * ID_Tp_Reconhecimento = "W"
 * ```
 */
export const WARRANTY_RECOGNITION_TYPE = 'W'

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
export function recognitionCapacity(
  input: RecognitionCapacityInput,
): RecognitionCapacity | null {
  const { Sell_Price, Warranty_Reserve, ID_Tp_Reconhecimento } = input

  if (ID_Tp_Reconhecimento === null) return null
  if (Warranty_Reserve === null) return null

  if (ID_Tp_Reconhecimento === WARRANTY_RECOGNITION_TYPE) {
    // AGENT.md §14 "Warranty maximum": Warranty_Reserve
    return Warranty_Reserve
  }

  if (Sell_Price === null) return null

  // AGENT.md §14 "Non-warranty maximum": Sell_Price - Warranty_Reserve
  return Sell_Price - Warranty_Reserve
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