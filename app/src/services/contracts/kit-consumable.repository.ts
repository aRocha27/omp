/**
 * Repository contract for the Kit_Consumables sub-table.
 *
 * UI code depends on this interface, never on a concrete mock/HTTP implementation.
 * Mock and live HTTP repositories implement the same read and mutation behaviour
 * so the order-detail Kit tab does not depend on the active data mode. Mirrors the
 * ReconhecimentoRepository shape (minus propagation, which Kit_Consumables lacks).
 */
import type { KitConsumable } from '@/domain/models/kit-consumable'
import type { Role } from '@/domain/models/user'

// Re-export so HTTP/mock implementations and callers import the shared error
// type from their own contract (mirrors reconhecimento.repository).
export { RepositoryError } from './orders.repository'

/**
 * Shape callers use when adding a kit consumable. The PK (`ID_Kit`) is assigned
 * by the repository. Every business field is required (non-null) to mirror the
 * live Zod schema in `server/src/validation.ts`: the UI validates these before
 * the call, and the server rejects nulls. `Total_Price` is typically
 * `Quant * Unit_Price`, computed in the form and sent as-is.
 */
export type NewKitConsumable = {
  ID_Order: number
  Date: string
  Internal_Order: string
  Material: string
  Description: string
  Quant: number
  Unit_Price: number
  Total_Price: number
}

/** Patch for editing an existing kit consumable. The PK and `ID_Order` are fixed. */
export type KitConsumablePatch = Partial<
  Pick<
    KitConsumable,
    'Date' | 'Internal_Order' | 'Material' | 'Description' | 'Quant' | 'Unit_Price' | 'Total_Price'
  >
>

/**
 * Read + write path for a single order's kit consumables.
 *
 * `listByOrder` backs the Kit tab of the order detail page; `add`/`update`/`remove`
 * back the inline edit/delete actions. The server applies no capacity constraint
 * (the Saldo = Kit_Amount − Σ Total_Price is display-only), so — unlike
 * Reconhecimento — no capacity assertion is part of this contract.
 */
export interface KitConsumableRepository {
  /** All kit consumables for a given `ID_Order`, ordered by `ID_Kit`. */
  listByOrder(orderId: number): Promise<KitConsumable[]>

  /** Append a new kit consumable. Assigns the PK. */
  add(entry: NewKitConsumable, role: Role): Promise<KitConsumable>

  /** Edit an existing kit consumable by PK. */
  update(id: number, patch: KitConsumablePatch, role: Role): Promise<KitConsumable>

  /** Hard-delete an existing kit consumable by PK (dbo.Kit_Consumables has no deleted_at). */
  remove(id: number, role: Role): Promise<void>
}