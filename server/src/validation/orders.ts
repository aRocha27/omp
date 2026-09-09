/**
 * Orders Zod schemas (list, facets, detail, update, create, warranty-years).
 */
import { z } from 'zod'
import { orderDateSchema } from './primitives.js'

export const orderPageSortSchema = z.object({
  id: z.enum([
    'DT_Order',
    'ID_Order',
    'Encomenda_Cli_PHC',
    'Order_Factory',
    'Kit',
    'Client_Name',
    'Sell_Price',
    'ID_Client',
    'ID_Tp_Order',
    'ID_Area',
    'ID_Tipo',
    'ID_Produto',
    'ID_Instrumento',
    'Negocio_Fechado',
    'ID_Tp_Warranty',
    'Warranty_Reserve',
    'Warranty_DT_Inicio',
    'Orc_Proposta',
    'PO_Cliente',
    'ID_Tp_Revenue',
  ]),
  direction: z.enum(['asc', 'desc']),
})

// Orders list filters. Every field is optional; the frontend normalises null/''/empty
// arrays away before sending, so `.optional()` (which rejects null) is strict enough.
// Categorical filters (order type, area, tipo, product, instrument) are multi-select
// arrays — the backend expands them to parameterized `IN (@p0, @p1, …)` clauses. The
// booleans are "only show…" toggles (the UI sends `true` only; `false` is dropped).
export const orderFiltersSchema = z.object({
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
  invoiceNumber: z.string().trim().optional(),
  negocioFechado: z.boolean().optional(),
})

export const ordersListBodySchema = z.object({
  filters: orderFiltersSchema.optional().default({}),
  limit: z.number().int().min(1).max(10000).optional(),
  offset: z.number().int().min(0).max(1_000_000).optional(),
})

export const ordersFacetsBodySchema = z.object({
  filters: orderFiltersSchema.optional().default({}),
})

export const ordersPageBodySchema = z.object({
  filters: orderFiltersSchema.optional().default({}),
  sort: orderPageSortSchema.optional().default({ id: 'DT_Order', direction: 'desc' }),
  limit: z.number().int().min(300).max(500).default(300),
  offset: z.number().int().min(0).max(1_000_000).optional(),
  cursor: z.string().trim().min(1).max(512).optional(),
})

export type OrdersPageBody = z.infer<typeof ordersPageBodySchema>

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
export const orderUpdatePatchSchema = z.object({
  DT_Order: orderDateSchema.nullable().optional(),
  Order_Factory: z.boolean().nullable().optional(),
  ID_Tp_Order: z.string().nullable().optional(),
  Encomenda_Cli_PHC: z.string().nullable().optional(),
  ID_Client: z.number().int().nullable().optional(),
  ID_Area: z.string().nullable().optional(),
  ID_Tipo: z.string().nullable().optional(),
  ID_Produto: z.number().int().nullable().optional(),
  ID_Instrumento: z.number().int().nullable().optional(),
  Orc_Proposta: z.string().nullable().optional(),
  PO_Cliente: z.string().nullable().optional(),
  Email: z.string().nullable().optional(),
  Contacto: z.string().nullable().optional(),
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

export const orderCreateBodySchema = orderUpdatePatchSchema
  .extend({
    ID_Client: z.number().int().positive(),
    ID_Tp_Order: z.string().trim().min(1),
    Encomenda_Cli_PHC: z.string().trim().min(1, 'SAP Order Number is required.'),
  })
  .omit({ Facturado: true, Reconhecido: true, Negocio_Fechado: true })
  .superRefine((body, context) => {
    if (body.ID_Tp_Order !== 'C') return
    const required: Array<[keyof typeof body, unknown]> = [
      ['DT_Order', body.DT_Order],
      ['ID_Area', body.ID_Area],
      ['ID_Tipo', body.ID_Tipo],
      ['ID_Produto', body.ID_Produto],
      ['ID_Instrumento', body.ID_Instrumento],
      ['Sell_Price', body.Sell_Price],
      ['ID_Tp_Revenue', body.ID_Tp_Revenue],
    ]
    for (const [field, value] of required) {
      if (value == null || value === '') {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: `${String(field)} is required for Client orders.`,
        })
      }
    }
  })

export const orderUpdateBodySchema = z.object({
  id: z.number().int().positive(),
  patch: orderUpdatePatchSchema.default({}),
})

export const orderWarrantyYearsBodySchema = z.object({
  id: z.number().int().positive(),
  years: z.number().int().min(1).max(5),
})

export type OrderWarrantyYearsBody = z.infer<typeof orderWarrantyYearsBodySchema>
export type OrderUpdateBody = z.infer<typeof orderUpdateBodySchema>
