/**
 * Barrel re-export for the split Zod schemas.
 *
 * Splits the original monolithic `validation.ts` into per-domain files so
 * a developer can find "where does this endpoint's request shape get
 * validated?" by looking at `server/src/validation/<entity>.ts`. Existing
 * call sites keep importing from `../validation.js` (re-exported from
 * the new `validation/index.ts`).
 */
export * from './primitives.js'
export * from './admin.js'
export * from './orders.js'
export * from './sub-tables.js'
export * from './clients.js'
export * from './reference.js'