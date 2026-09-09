/**
 * Clients Zod schemas (list filters, create, update).
 */
import { z } from 'zod'
import { clientOptionalString } from './primitives.js'

// Clients list filters. `search` is a contains match across nome / tax number / PHC code
// (the db layer applies the LIKE). `idTpCliente` is the multi-select of client-type FKs.
export const clientFiltersSchema = z.object({
  search: z.string().trim().optional(),
  idTpCliente: z.array(z.number().int()).optional(),
})

export const clientsListBodySchema = z.object({
  filters: clientFiltersSchema.optional().default({}),
  limit: z.number().int().min(1).max(10000).optional(),
})

export type ClientsListBody = z.infer<typeof clientsListBodySchema>

// Clients create endpoint. Seven fields are required (Name, Address, Location,
// Postal Code, SAP number, Tax Number, Type); everything else is optional and
// nullable so a partial record can be fleshed out via the edit flow later. The
// acting identity is taken from the server-side role header, never from the body.
export const clientCreateBodySchema = z.object({
  nome: z.string().trim().min(1, 'name is required'),
  morada: z.string().trim().min(1, 'address is required'),
  local: z.string().trim().min(1, 'location is required'),
  codpost: z.string().trim().min(1, 'postal_code is required'),
  no_PHC: z.number().int().nonnegative(),
  ncont: z.string().trim().min(1, 'tax_number is required'),
  ID_Tp_Cliente: z.number().int().positive(),
  telefone: clientOptionalString,
  contacto: clientOptionalString,
  fax: clientOptionalString,
  zona: clientOptionalString,
})

// Clients update endpoint. `patch` is partial — every field is optional and
// nullable so the route can clear a value. zod strips unknown keys; the db
// layer additionally filters by its UPDATEABLE_COLUMNS whitelist.
export const clientUpdatePatchSchema = z.object({
  no_PHC: z.number().int().nonnegative().nullable().optional(),
  ID_Tp_Cliente: z.number().int().positive().nullable().optional(),
  nome: z.string().trim().min(1).nullable().optional(),
  ncont: z.string().trim().min(1).nullable().optional(),
  fax: z.string().trim().nullable().optional(),
  telefone: z.string().trim().nullable().optional(),
  contacto: z.string().trim().nullable().optional(),
  morada: z.string().trim().min(1).nullable().optional(),
  local: z.string().trim().min(1).nullable().optional(),
  codpost: z.string().trim().min(1).nullable().optional(),
  zona: z.string().trim().nullable().optional(),
  Defense: z.boolean().nullable().optional(),
})

export const clientUpdateBodySchema = z.object({
  id: z.number().int().positive(),
  patch: clientUpdatePatchSchema.default({}),
})

export type ClientUpdateBody = z.infer<typeof clientUpdateBodySchema>