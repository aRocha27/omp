/**
 * Sub-table Zod schemas (Reconhecimento, Facturacao, Kit_Consumables).
 */
import { z } from 'zod'
import { orderDateSchema, positiveIdBodySchema } from './primitives.js'

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

const reconhecimentoPatchSchema = z.object({
  ID_Tp_Reconhecimento: z.string().trim().min(1).optional(),
  DT_Reconhecimento: orderDateSchema.optional(),
  Valor_Reconhecimento: z.number().finite().nonnegative().optional(),
})

export const reconhecimentoUpdateBodySchema = z.object({
  id: z.number().int().positive(),
  patch: reconhecimentoPatchSchema.default({}),
})

export const reconhecimentoDeleteBodySchema = positiveIdBodySchema

export const reconhecimentoPropagateBodySchema = z.discriminatedUnion('kind', [
  z.object({
    orderId: z.number().int().positive(),
    kind: z.literal('warranty'),
  }),
  z.object({
    orderId: z.number().int().positive(),
    kind: z.literal('maintenance'),
    startDate: orderDateSchema,
    years: z.number().int().min(1).max(100),
    recognitionDate: orderDateSchema,
  }),
])

const facturacaoPatchSchema = z.object({
  DT_Doc_FT: orderDateSchema.optional(),
  ID_Tp_Doc_FT: z.string().trim().min(1).optional(),
  N_Doc_FT: z.string().trim().min(1).optional(),
  Valor_Doc_FT: z.number().finite().optional(),
  Imprimiu: z.boolean().nullable().optional(),
  Imp_Block: z.boolean().nullable().optional(),
  Nome_PDF: z.string().trim().min(1).nullable().optional(),
  E_Invoice: z.boolean().nullable().optional(),
})

export const facturacaoUpdateBodySchema = z.object({
  id: z.number().int().positive(),
  patch: facturacaoPatchSchema.default({}),
})

export const facturacaoDeleteBodySchema = positiveIdBodySchema

export const emailDocumentsBodySchema = z.object({
  orderId: z.number().int().positive(),
  documentIds: z.array(z.number().int().positive()).min(1).max(50),
  attachments: z.record(z.string(), z.string().max(20_000_000)).optional(),
  attachmentNames: z.record(z.string(), z.string().trim().min(1).max(255)).optional(),
})

export const emailAllDocumentsBodySchema = z.object({
  documentIds: z.array(z.number().int().positive()).min(1).max(500),
  attachments: z.record(z.string(), z.string().max(20_000_000)).optional(),
  attachmentNames: z.record(z.string(), z.string().trim().min(1).max(255)).optional(),
  recipients: z.record(z.string(), z.array(z.string().email()).min(1).max(50)).optional(),
})

// Kit_Consumables sub-table. The client sends Total_Price (typically Quant * Unit_Price);
// the server accepts it but validates non-negativity. Quant is a positive integer, the
// money fields are finite and non-negative. Mirrors the Reconhecimento/Facturacao create
// schemas (ID_Order positive, date valid, strings non-empty).
export const kitConsumableCreateBodySchema = z.object({
  ID_Order: z.number().int().positive(),
  Date: orderDateSchema,
  Internal_Order: z.string().trim().min(1),
  Material: z.string().trim().min(1),
  Description: z.string().trim().min(1),
  Quant: z.number().int().positive(),
  Unit_Price: z.number().finite().nonnegative(),
  Total_Price: z.number().finite().nonnegative(),
})

const kitConsumablePatchSchema = z.object({
  Date: orderDateSchema.optional(),
  Internal_Order: z.string().trim().min(1).optional(),
  Material: z.string().trim().min(1).optional(),
  Description: z.string().trim().min(1).optional(),
  Quant: z.number().int().positive().optional(),
  Unit_Price: z.number().finite().nonnegative().optional(),
  Total_Price: z.number().finite().nonnegative().optional(),
})

export const kitConsumableUpdateBodySchema = z.object({
  id: z.number().int().positive(),
  patch: kitConsumablePatchSchema.default({}),
})

export const kitConsumableDeleteBodySchema = positiveIdBodySchema

export const utilizadorCreateBodySchema = z.object({
  ID_User: z.string().trim().min(1).max(50),
  User_Name: z.string().trim().min(1).max(100),
  Admin: z.boolean().default(false),
  Obs: z.string().max(2000).nullable().optional(),
})
