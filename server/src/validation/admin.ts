/**
 * Zod schemas for the admin endpoints (connection, tables, sync).
 *
 * The `superRefine` that rejects "credentials XOR profileId" used to be
 * copy-pasted into `connectBodySchema`, `syncBodySchema`, and
 * `syncAllBodySchema`. `discriminatedConnectionBody` factors the
 * discriminated union into a reusable shape so every admin schema can
 * extend it without re-implementing the rule.
 */
import { z } from 'zod'
import { portSchema } from './primitives.js'

const credentialsSchema = z.object({
  server: z.string().trim().min(1, 'server is required'),
  port: portSchema,
  database: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  user: z.string().trim().min(1, 'user is required'),
  password: z.string().min(1, 'password is required'),
})

const profileIdSchema = z.string().trim().min(1, 'profileId is required')

/**
 * Returns a Zod schema whose object body accepts EITHER `credentials` OR
 * `profileId` (never both, never neither). The `superRefine` is shared by
 * every admin endpoint that opens an mssql pool.
 */
export const discriminatedConnectionBody = () =>
  z
    .object({
      credentials: credentialsSchema.optional(),
      profileId: profileIdSchema.optional(),
    })
    .superRefine((data, context) => {
      const hasCredentials = data.credentials !== undefined
      const hasProfile = data.profileId !== undefined
      if (hasCredentials && hasProfile) {
        context.addIssue({
          code: 'custom',
          message: 'Provide either credentials or profileId, not both',
        })
      } else if (!hasCredentials && !hasProfile) {
        context.addIssue({ code: 'custom', message: 'Provide either credentials or profileId' })
      }
    })

export const connectBodySchema = discriminatedConnectionBody()
export const tablesBodySchema = connectBodySchema
export const databaseSelectionBodySchema = discriminatedConnectionBody().extend({
  scope: z.enum(['session', 'global']),
  profileName: z.string().trim().max(100).optional(),
})

export const syncBodySchema = discriminatedConnectionBody().extend({
  schema: z.string().trim().min(1, 'schema is required'),
  table: z.string().trim().min(1, 'table is required'),
  limit: z.number().int().min(1).max(1000).default(200),
})

export const syncAllBodySchema = discriminatedConnectionBody().extend({
  limit: z.number().int().min(1).max(1000).default(200),
})

export const masterDataTableSchema = z.enum([
  'Area',
  'ChargeCategory',
  'Grp_Report',
  'Identificacao',
  'Produto',
  'ServiceType',
  'Tipo',
  'Tp_Cliente',
  'Tp_Doc_FT',
  'Tp_Order',
  'Tp_Reconhecimento',
  'Tp_Revenue',
  'Tp_Warranty',
  'Instrumento',
  'Utilizador',
  'stck_Materiais',
  'stck_Armazens',
])
const masterDataValuesSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
)
const optionalConnectionFields = {
  credentials: credentialsSchema.optional(),
  profileId: profileIdSchema.optional(),
}
export const masterDataCreateBodySchema = z.object({
  ...optionalConnectionFields,
  table: masterDataTableSchema,
  values: masterDataValuesSchema,
})
export const masterDataDeleteBodySchema = z.object({
  ...optionalConnectionFields,
  table: masterDataTableSchema,
  key: z.string().trim().min(1),
  value: z.union([z.string(), z.number()]),
})
export const masterDataUpdateBodySchema = masterDataCreateBodySchema.extend({
  key: z.string().trim().min(1),
  value: z.union([z.string(), z.number()]),
})

export type ConnectBody = z.infer<typeof connectBodySchema>
export type TablesBody = z.infer<typeof tablesBodySchema>
export type SyncBody = z.infer<typeof syncBodySchema>
export type SyncAllBody = z.infer<typeof syncAllBodySchema>
