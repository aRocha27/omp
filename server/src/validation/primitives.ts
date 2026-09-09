/**
 * Shared Zod primitives used across the per-domain validation files.
 *
 * The original `validation.ts` redeclared `portSchema`, `orderDateSchema`,
 * `clientOptionalString`, and `positiveIdBodySchema` inline — one copy each.
 * Promoting them here keeps every per-domain file focused on its own shape
 * while letting the route files import a single primitive.
 */
import { z } from 'zod'

export const portSchema = z.number().int().min(1).max(65535)

/** ISO-8601-ish date string. Coarse validation only — the SQL side is the
 *  final word on whether a value parses as a `datetime`. */
export const orderDateSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid date')

/** Trims, requires non-empty when present, allows `null`/`undefined`. Used
 *  by the Clients write schemas (postal code, address, …). */
export const clientOptionalString = z.string().trim().min(1).nullable().optional()

/** `{ id: <positive int> }` — body shape for DELETE endpoints and any
 *  other call that only needs an identifier. */
export const positiveIdBodySchema = z.object({ id: z.number().int().positive() })