/**
 * Barrel re-export for the split wire types.
 *
 * Splits the original monolithic `types.ts` into one file per domain so a
 * developer can answer "where does this column get its type from?" by
 * looking at `server/src/types/<entity>.ts`. Existing call sites can keep
 * importing from `../types.js` (which re-exports this barrel) until they
 * migrate.
 */
export * from './connection'
export * from './order'
export * from './dashboard'
export * from './filters'
export * from './recognition-report'
export * from './client'
export * from './sub-tables'
export * from './reference'
export * from './utilizador'
export * from './master-data'
export * from './report'
