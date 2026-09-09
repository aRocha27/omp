/**
 * Re-export of the split wire types.
 *
 * The original monolithic `types.ts` is decomposed into
 * `server/src/types/<entity>.ts`. The barrel `types/index.ts` re-exports
 * them; this file simply re-exports the barrel so existing imports
 * (`from '../types.js'`) keep working unchanged.
 *
 * New code should prefer importing from `types/<entity>.js` to make the
 * dependency obvious; the barrel exists for backwards compatibility.
 */
export * from './types/index.js'