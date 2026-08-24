import { z } from 'zod'

// Zod schemas for the admin endpoints. Every connect/tables/sync endpoint
// accepts EITHER ad-hoc credentials OR a profileId — never both, never neither.

const portSchema = z.number().int().min(1).max(65535)

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

// Discriminated union: exactly one of credentials / profileId.
export const connectBodySchema = z
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

export const tablesBodySchema = connectBodySchema

export const syncBodySchema = z
  .object({
    credentials: credentialsSchema.optional(),
    profileId: profileIdSchema.optional(),
    schema: z.string().trim().min(1, 'schema is required'),
    table: z.string().trim().min(1, 'table is required'),
    limit: z.number().int().min(1).max(1000).default(200),
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

export const syncAllBodySchema = z
  .object({
    credentials: credentialsSchema.optional(),
    profileId: profileIdSchema.optional(),
    limit: z.number().int().min(1).max(1000).default(200),
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

export type ConnectBody = z.infer<typeof connectBodySchema>
export type TablesBody = z.infer<typeof tablesBodySchema>
export type SyncBody = z.infer<typeof syncBodySchema>
export type SyncAllBody = z.infer<typeof syncAllBodySchema>

// Orders list filters. Every field is optional; the frontend normalises null/''/empty
// arrays away before sending, so `.optional()` (which rejects null) is strict enough.
// Categorical filters (order type, area, tipo, product, instrument) are multi-select
// arrays — the backend expands them to parameterized `IN (@p0, @p1, …)` clauses. The
// booleans are "only show…" toggles (the UI sends `true` only; `false` is dropped).
const orderFiltersSchema = z.object({
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  clientName: z.string().trim().optional(),
  orderFactory: z.boolean().optional(),
  idTpOrder: z.array(z.string().trim().min(1)).optional(),
  idArea: z.array(z.string().trim().min(1)).optional(),
  idTipo: z.array(z.string().trim().min(1)).optional(),
  idProduto: z.array(z.number().int()).optional(),
  idInstrumento: z.array(z.number().int()).optional(),
  encomendaCliPHC: z.string().trim().optional(),
  negocioFechado: z.boolean().optional(),
})

const orderDateSchema = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid date')

export const ordersListBodySchema = z.object({
  filters: orderFiltersSchema.optional().default({}),
  limit: z.number().int().min(1).max(1000).default(200),
})

export type OrdersListBody = z.infer<typeof ordersListBodySchema>

// Orders detail endpoint takes the order id as a query parameter (?id=N). It must be a
// positive integer. Returns `undefined` when the param is absent so the router can 400
// (the contract has no "list all" detail) and `null` when present but invalid.
export const orderIdParamSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined ? undefined : Number(value)))
  .pipe(z.number().int().positive())

export type OrderIdParam = z.infer<typeof orderIdParamSchema>

// Orders update endpoint. `patch` is a partial of the updatable Order columns — zod
// strips unknown keys (the db layer additionally ignores anything outside its hardcoded
// whitelist, so unknown keys can never reach the SET clause). Every field is optional and
// nullable. `id` is a positive integer; the acting identity is taken from the server-side
// request context/role and is never accepted from the body.
const orderUpdatePatchSchema = z.object({
  DT_Order: orderDateSchema.nullable().optional(),
  ID_Tp_Order: z.string().nullable().optional(),
  Encomenda_Cli_PHC: z.string().nullable().optional(),
  ID_Client: z.number().int().nullable().optional(),
  ID_Area: z.string().nullable().optional(),
  ID_Tipo: z.string().nullable().optional(),
  ID_Produto: z.number().int().nullable().optional(),
  ID_Instrumento: z.number().int().nullable().optional(),
  Orc_Proposta: z.string().nullable().optional(),
  PO_Cliente: z.string().nullable().optional(),
  Sell_Price: z.number().finite().nonnegative().nullable().optional(),
  ID_Tp_Warranty: z.number().int().nullable().optional(),
  Warranty_Reserve: z.number().finite().nonnegative().nullable().optional(),
  Warranty_DT_Inicio: orderDateSchema.nullable().optional(),
  ID_Tp_Revenue: z.number().int().nullable().optional(),
  Facturado: z.boolean().nullable().optional(),
  Reconhecido: z.boolean().nullable().optional(),
  Cod_Enc_Fornecedor: z.string().nullable().optional(),
  Obs: z.string().nullable().optional(),
  Negocio_Fechado: z.boolean().nullable().optional(),
  Kit: z.boolean().nullable().optional(),
  Kit_Amount: z.number().int().nonnegative().nullable().optional(),
})

export const orderCreateBodySchema = orderUpdatePatchSchema.extend({
  DT_Order: orderDateSchema,
  ID_Client: z.number().int().positive(),
  ID_Tp_Order: z.string().trim().min(1),
  ID_Area: z.string().trim().min(1),
  ID_Tipo: z.string().trim().min(1),
  ID_Produto: z.number().int().positive(),
}).omit({ Facturado: true, Reconhecido: true, Negocio_Fechado: true })

export const orderUpdateBodySchema = z.object({
  id: z.number().int().positive(),
  patch: orderUpdatePatchSchema.default({}),
})

export type OrderUpdateBody = z.infer<typeof orderUpdateBodySchema>

export const reconhecimentoCreateBodySchema = z.object({
  ID_Order: z.number().int().positive(),
  ID_Tp_Reconhecimento: z.string().trim().min(1),
  DT_Reconhecimento: orderDateSchema,
  Valor_Reconhecimento: z.number().finite().nonnegative(),
})

export const facturacaoCreateBodySchema = z.object({
  ID_Order: z.number().int().positive(),
  DT_Doc_FT: orderDateSchema,
  ID_Tp_Doc_FT: z.string().trim().min(1),
  N_Doc_FT: z.string().trim().min(1),
  Valor_Doc_FT: z.number().finite(),
})

export const utilizadorCreateBodySchema = z.object({
  ID_User: z.string().trim().min(1).max(50),
  User_Name: z.string().trim().min(1).max(100),
  Admin: z.boolean().default(false),
  Obs: z.string().max(2000).nullable().optional(),
})

// Clients list filters. `search` is a contains match across nome / tax number / PHC code
// (the db layer applies the LIKE). `idTpCliente` is the multi-select of client-type FKs.
const clientFiltersSchema = z.object({
  search: z.string().trim().optional(),
  idTpCliente: z.array(z.number().int()).optional(),
})

export const clientsListBodySchema = z.object({
  filters: clientFiltersSchema.optional().default({}),
  limit: z.number().int().min(1).max(1000).default(200),
})

export type ClientsListBody = z.infer<typeof clientsListBodySchema>

// Sub-table reads take the order id as a query parameter (?orderId=N). Positive integer.
// Mirrors orderIdParamSchema but bound to the `orderId` query key.
export const orderIdQueryParamSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined ? undefined : Number(value)))
  .pipe(z.number().int().positive())

export type OrderIdQueryParam = z.infer<typeof orderIdQueryParamSchema>
