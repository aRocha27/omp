/**
 * Re-export of the split Zod schemas.
 *
 * The original monolithic `validation.ts` is decomposed into per-domain
 * files under `server/src/validation/`. The barrel `validation/index.ts`
 * re-exports them; this file re-exports the barrel so existing imports
 * (`from '../validation.js'`) keep working unchanged.
 */
export * from './validation/index.js'