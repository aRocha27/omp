import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import type { ConnectionPool } from 'mssql'
import type {
  ConnectionConfig,
  DocumentoFaturacaoRow,
  DocumentoFaturacaoTypeRow,
  OkFacturacao,
  OkOrder,
  OkOrders,
  OkOrderPage,
  OkOrderUpdate,
  OkOrderCreate,
  OkReconhecimentos,
  OkKitConsumables,
  OrderDetailRow,
  OrderSummaryRow,
  OrderFacets,
  OrderUpdateChanges,
  OrderCreateInput,
  ReconhecimentoRow,
  NewReconhecimentoInput,
  NewFacturacaoInput,
  ReconhecimentoPatch,
  FacturacaoPatch,
  PropagateReconhecimentoInput,
  KitConsumableRow,
  NewKitConsumableInput,
  KitConsumablePatch,
} from '../types.js'
import type { OrderListFilters } from '../db.js'
import {
  isHistoricoRow,
  isLockedCaracterizacaoField,
} from '../repositories/orders/order-caracterizacao.js'
import {
  orderIdQueryParamSchema,
  ordersListBodySchema,
  ordersPageBodySchema,
  ordersFacetsBodySchema,
  orderIdParamSchema,
  orderCreateBodySchema,
  orderUpdateBodySchema,
  orderWarrantyYearsBodySchema,
  reconhecimentoCreateBodySchema,
  reconhecimentoDeleteBodySchema,
  reconhecimentoPropagateBodySchema,
  reconhecimentoUpdateBodySchema,
  facturacaoCreateBodySchema,
  facturacaoDeleteBodySchema,
  facturacaoUpdateBodySchema,
  kitConsumableCreateBodySchema,
  kitConsumableDeleteBodySchema,
  kitConsumableUpdateBodySchema,
  emailDocumentsBodySchema,
  emailAllDocumentsBodySchema,
} from '../validation.js'
import { RouteError, sendError, withPool } from './http-errors.js'
import { decodeOrderCursor } from '../repositories/orders/orders.repository.js'
import {
  buildInvoiceEmail,
  readTestRecipient,
  resolvePdfAttachment,
  type EmailDependencies,
} from '../email.js'

// The Orders tab never sends credentials — it reads through a server-configured managed
// profile (password in env). These are the only collaborators the router needs.
export interface OrdersDependencies {
  sendEmail?: EmailDependencies['send']
  resolveOrdersProfile: () => ConnectionConfig
  openPool: (connection: ConnectionConfig) => Promise<ConnectionPool>
  fetchOrderSummaries: (
    pool: ConnectionPool,
    filters: OrderListFilters,
    limit?: number,
    offset?: number,
  ) => Promise<OrderSummaryRow[]>
  fetchPagedOrderSummaries?: (
    pool: ConnectionPool,
    input: import('../types.js').OrderPageRequest,
  ) => Promise<import('../types.js').OrderPage>
  fetchOrderFacets?: (pool: ConnectionPool, filters: OrderListFilters) => Promise<OrderFacets>
  fetchOrderById: (pool: ConnectionPool, id: number) => Promise<OrderDetailRow | null>
  updateOrder: (
    pool: ConnectionPool,
    id: number,
    changes: OrderUpdateChanges,
  ) => Promise<OrderDetailRow | null>
  appendOrderAudit?: (
    pool: ConnectionPool,
    id: number,
    entry: string,
    user: string,
  ) => Promise<boolean>
  createOrder: (
    pool: ConnectionPool,
    input: OrderCreateInput,
    user: string,
  ) => Promise<OrderDetailRow>
  fetchReconhecimentos: (pool: ConnectionPool, orderId: number) => Promise<ReconhecimentoRow[]>
  fetchFacturacao: (pool: ConnectionPool, orderId: number) => Promise<DocumentoFaturacaoRow[]>
  fetchAllFacturacao?: (
    pool: ConnectionPool,
    filters?: { from?: string; to?: string },
  ) => Promise<DocumentoFaturacaoRow[]>
  fetchFacturacaoTypes: (pool: ConnectionPool) => Promise<DocumentoFaturacaoTypeRow[]>
  addReconhecimento: (
    pool: ConnectionPool,
    input: NewReconhecimentoInput,
    user: string,
  ) => Promise<ReconhecimentoRow>
  updateReconhecimento: (
    pool: ConnectionPool,
    id: number,
    patch: ReconhecimentoPatch,
    user: string,
  ) => Promise<ReconhecimentoRow | null>
  deleteReconhecimento: (pool: ConnectionPool, id: number) => Promise<boolean>
  propagateReconhecimento: (
    pool: ConnectionPool,
    input: PropagateReconhecimentoInput,
    user: string,
  ) => Promise<ReconhecimentoRow[]>
  addFacturacao: (
    pool: ConnectionPool,
    input: NewFacturacaoInput,
    user: string,
  ) => Promise<DocumentoFaturacaoRow>
  updateFacturacao: (
    pool: ConnectionPool,
    id: number,
    patch: FacturacaoPatch,
    user: string,
  ) => Promise<DocumentoFaturacaoRow | null>
  deleteFacturacao: (pool: ConnectionPool, id: number) => Promise<boolean>
  fetchKitConsumables: (pool: ConnectionPool, orderId: number) => Promise<KitConsumableRow[]>
  addKitConsumable: (
    pool: ConnectionPool,
    input: NewKitConsumableInput,
  ) => Promise<KitConsumableRow>
  updateKitConsumable: (
    pool: ConnectionPool,
    id: number,
    patch: KitConsumablePatch,
  ) => Promise<KitConsumableRow | null>
  deleteKitConsumable: (pool: ConnectionPool, id: number) => Promise<boolean>
  updateOrderWarrantyYears: (
    pool: ConnectionPool,
    id: number,
    years: number,
    user: string,
  ) => Promise<boolean>
}

type UserRole = 'viewer' | 'editor' | 'admin'

export interface OrdersAuthorization {
  /** A successful request already passed configured bearer-token authentication. */
  authenticatedAdmin: boolean
}

function readUserRole(
  authorization: OrdersAuthorization,
  header: string | string[] | undefined,
): UserRole {
  // A configured ADMIN_API_TOKEN is the authority. Never let a caller downgrade or
  // impersonate a different role through the development-only header.
  if (authorization.authenticatedAdmin) return 'admin'

  // Tokenless mode is boot-guarded to loopback. It may simulate roles explicitly,
  // but missing and unrecognised values fail closed as viewer.
  const value = typeof header === 'string' ? header.trim().toLowerCase() : ''
  if (value === 'user' || value === 'editor') return 'editor'
  if (value === 'viewer' || value === 'admin') return value
  return 'viewer'
}

function actorId(request: Request, role: UserRole): string {
  return request.authUser?.id ?? role
}

export function createOrdersRouter(
  dependencies: OrdersDependencies,
  authorization: OrdersAuthorization,
): Router {
  const router = Router()

  router.post('/api/orders/list', async (request: Request, response: Response) => {
    try {
      const body = ordersListBodySchema.parse(request.body)
      const connection = dependencies.resolveOrdersProfile()
      const orders = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchOrderSummaries(pool, body.filters, body.limit, body.offset),
      )
      const payload: OkOrders = { ok: true, orders }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/orders/page', async (request: Request, response: Response) => {
    try {
      const body = ordersPageBodySchema.parse(request.body)
      const fetchPaged = dependencies.fetchPagedOrderSummaries
      if (!fetchPaged)
        throw new RouteError('orders-not-configured', 500, 'Paged orders are unavailable.')
      if (body.cursor && body.sort.id !== 'DT_Order') {
        throw new RouteError(
          'validation',
          400,
          'Cursors are supported only for the default order sort.',
        )
      }
      if (body.cursor) {
        try {
          decodeOrderCursor(body.cursor)
        } catch {
          throw new RouteError('validation', 400, 'The order cursor is invalid.')
        }
      }
      const connection = dependencies.resolveOrdersProfile()
      const page = await withPool(dependencies.openPool, connection, (pool) =>
        fetchPaged(pool, body),
      )
      const payload: OkOrderPage = { ok: true, ...page }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/orders/facets', async (request: Request, response: Response) => {
    try {
      const body = ordersFacetsBodySchema.parse(request.body)
      const fetchOrderFacets = dependencies.fetchOrderFacets
      if (!fetchOrderFacets) throw new Error('Order facets are not configured.')
      const connection = dependencies.resolveOrdersProfile()
      const facets = await withPool(dependencies.openPool, connection, (pool) =>
        fetchOrderFacets(pool, body.filters),
      )
      response.json({ ok: true, facets })
    } catch (error) {
      sendError(response, error)
    }
  })

  router.get('/api/orders', async (request: Request, response: Response) => {
    try {
      const id = orderIdParamSchema.parse(request.query.id)
      const connection = dependencies.resolveOrdersProfile()
      const order = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchOrderById(pool, id),
      )
      // A missing order is not a 404 — the repository contract uses null so the UI can
      // render its own not-found state without distinguishing transport from empty.
      const payload: OkOrder = { ok: true, order }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/orders/update', async (request: Request, response: Response) => {
    try {
      const body = orderUpdateBodySchema.parse(request.body)
      const role = readUserRole(authorization, request.headers['x-user-role'])
      if (role === 'viewer') {
        throw new RouteError('forbidden', 403, 'Viewers may not update orders.')
      }
      const connection = dependencies.resolveOrdersProfile()

      const current = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchOrderById(pool, body.id),
      )
      if (!current) {
        throw new RouteError('not-found', 404, `Order ${body.id} was not found.`)
      }

      // Defense in depth: the "bloqueio de caracterização após fecho do mês" rule is
      // enforced server-side, not just in the UI. Non-admin editors cannot touch locked
      // Caracterização fields on a histórico (past-month, non-provisional) order. Admins
      // override; provisional orders are always editable.
      if (role !== 'admin' && current.ID_Tp_Order === 'C' && isHistoricoRow(current)) {
        const locked = Object.keys(body.patch).filter(
          (field) =>
            field !== 'Warranty_DT_Inicio' &&
            field !== 'ID_Tp_Warranty' &&
            isLockedCaracterizacaoField(field),
        )
        if (locked.length > 0) {
          throw new RouteError(
            'field-locked',
            403,
            `Order ${body.id} is closed for the month and the following Caracterização fields are locked: ${locked.join(', ')}.`,
          )
        }
      }

      const updated = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.updateOrder(pool, body.id, {
          ...body.patch,
           user: actorId(request, role),
        }),
      )
      // updateOrder re-reads the row and returns null only when the id vanished between the
      // fetch above and the UPDATE (concurrent delete) — surface that as a 404 rather than a
      // 200/null so the client can distinguish the race from a normal read.
      if (!updated) {
        throw new RouteError('not-found', 404, `Order ${body.id} was not found.`)
      }
      const payload: OkOrderUpdate = { ok: true, order: updated }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/orders/audit', async (request: Request, response: Response) => {
    try {
      const body = z
        .object({
          id: z.number().int().positive(),
          entry: z.string().trim().min(1).max(4000),
        })
        .parse(request.body)
      const role = readUserRole(authorization, request.headers['x-user-role'])
      if (role === 'viewer')
        throw new RouteError('forbidden', 403, 'Viewers may not update order logs.')
      if (!dependencies.appendOrderAudit)
        throw new RouteError('orders-not-configured', 500, 'Order audit is unavailable.')
      const connection = dependencies.resolveOrdersProfile()
      const result = await withPool(dependencies.openPool, connection, (pool) =>
          dependencies.appendOrderAudit!(pool, body.id, body.entry, actorId(request, role)),
      )
      if (!result) return response.status(404).json({ ok: false, error: 'Order not found.' })
      return response.json({ ok: true })
    } catch (error) {
      return sendError(response, error)
    }
  })

  router.post('/api/orders', async (request: Request, response: Response) => {
    try {
      const body = orderCreateBodySchema.parse(request.body) as OrderCreateInput
      const role = readUserRole(authorization, request.headers['x-user-role'])
      if (role === 'viewer')
        throw new RouteError('forbidden', 403, 'Viewers may not create orders.')
      const connection = dependencies.resolveOrdersProfile()
      const order = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.createOrder(pool, body, actorId(request, role)),
      )
      const payload: OkOrderCreate = { ok: true, order }
      response.status(201).json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/orders/warranty-years', async (request: Request, response: Response) => {
    try {
      const body = orderWarrantyYearsBodySchema.parse(request.body)
      const role = readUserRole(authorization, request.headers['x-user-role'])
      if (role === 'viewer') {
        throw new RouteError('forbidden', 403, 'Viewers may not update warranty years.')
      }
      const connection = dependencies.resolveOrdersProfile()
      const updated = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.updateOrderWarrantyYears(pool, body.id, body.years, actorId(request, role)),
      )
      if (!updated) {
        throw new RouteError(
          'field-locked',
          400,
          `No warranty type is available for ${body.years} years on order ${body.id}.`,
        )
      }
      response.json({ ok: true, id: body.id, years: body.years })
    } catch (error) {
      sendError(response, error)
    }
  })

  router.get('/api/orders/reconhecimentos', async (request: Request, response: Response) => {
    try {
      const orderId = orderIdQueryParamSchema.parse(request.query.orderId)
      const connection = dependencies.resolveOrdersProfile()
      const rows = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchReconhecimentos(pool, orderId),
      )
      // Unknown orderId is not a 404 — the detail view renders an empty sub-table from a
      // 200/[] rather than distinguishing a missing order from one with no rows.
      const payload: OkReconhecimentos = { ok: true, rows }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.get('/api/orders/facturacao/types', async (_request: Request, response: Response) => {
    try {
      const connection = dependencies.resolveOrdersProfile()
      const types = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchFacturacaoTypes(pool),
      )
      response.json({ ok: true, types })
    } catch (error) {
      sendError(response, error)
    }
  })

  router.get('/api/orders/facturacao', async (request: Request, response: Response) => {
    try {
      const orderId = orderIdQueryParamSchema.parse(request.query.orderId)
      const connection = dependencies.resolveOrdersProfile()
      const rows = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchFacturacao(pool, orderId),
      )
      const payload: OkFacturacao = { ok: true, rows }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.get('/api/orders/facturacao/all', async (request: Request, response: Response) => {
    try {
      const filters = z
        .object({ from: z.string().date().optional(), to: z.string().date().optional() })
        .parse(request.query)
      if (filters.from && filters.to && filters.from > filters.to) {
        throw new RouteError(
          'validation',
          400,
          'The document start date must be before the end date.',
        )
      }
      if (!dependencies.fetchAllFacturacao) {
        throw new RouteError('orders-not-configured', 503, 'Document listing is unavailable.')
      }
      const connection = dependencies.resolveOrdersProfile()
      const rows = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchAllFacturacao!(pool, filters),
      )
      response.json({ ok: true, rows })
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/orders/reconhecimentos', async (request: Request, response: Response) => {
    try {
      const body = reconhecimentoCreateBodySchema.parse(request.body)
      const role = readUserRole(authorization, request.headers['x-user-role'])
      if (role === 'viewer')
        throw new RouteError('forbidden', 403, 'Viewers may not add recognition.')
      const connection = dependencies.resolveOrdersProfile()
      const row = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.addReconhecimento(pool, body, actorId(request, role)),
      )
      response.status(201).json({ ok: true, row })
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post(
    '/api/orders/reconhecimentos/update',
    async (request: Request, response: Response) => {
      try {
        const body = reconhecimentoUpdateBodySchema.parse(request.body)
        const role = readUserRole(authorization, request.headers['x-user-role'])
        if (role === 'viewer') {
          throw new RouteError('forbidden', 403, 'Viewers may not update recognition.')
        }
        const connection = dependencies.resolveOrdersProfile()
        const row = await withPool(dependencies.openPool, connection, (pool) =>
          dependencies.updateReconhecimento(pool, body.id, body.patch, actorId(request, role)),
        )
        if (!row) {
          throw new RouteError('not-found', 404, `Recognition ${body.id} was not found.`)
        }
        response.json({ ok: true, row })
      } catch (error) {
        sendError(response, error)
      }
    },
  )

  router.post(
    '/api/orders/reconhecimentos/delete',
    async (request: Request, response: Response) => {
      try {
        const body = reconhecimentoDeleteBodySchema.parse(request.body)
        const role = readUserRole(authorization, request.headers['x-user-role'])
        if (role === 'viewer') {
          throw new RouteError('forbidden', 403, 'Viewers may not delete recognition.')
        }
        const connection = dependencies.resolveOrdersProfile()
        const deleted = await withPool(dependencies.openPool, connection, (pool) =>
          dependencies.deleteReconhecimento(pool, body.id),
        )
        if (!deleted) {
          throw new RouteError('not-found', 404, `Recognition ${body.id} was not found.`)
        }
        response.json({ ok: true })
      } catch (error) {
        sendError(response, error)
      }
    },
  )

  router.post(
    '/api/orders/reconhecimentos/propagate',
    async (request: Request, response: Response) => {
      try {
        const body = reconhecimentoPropagateBodySchema.parse(request.body)
        const role = readUserRole(authorization, request.headers['x-user-role'])
        if (role === 'viewer') {
          throw new RouteError('forbidden', 403, 'Viewers may not propagate recognition.')
        }
        const connection = dependencies.resolveOrdersProfile()
        const rows = await withPool(dependencies.openPool, connection, (pool) =>
          dependencies.propagateReconhecimento(pool, body, actorId(request, role)),
        )
        response.status(201).json({ ok: true, rows })
      } catch (error) {
        sendError(response, error)
      }
    },
  )

  router.post('/api/orders/facturacao', async (request: Request, response: Response) => {
    try {
      const body = facturacaoCreateBodySchema.parse(request.body)
      const role = readUserRole(authorization, request.headers['x-user-role'])
      if (role === 'viewer') throw new RouteError('forbidden', 403, 'Viewers may not add invoices.')
      const connection = dependencies.resolveOrdersProfile()
      const row = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.addFacturacao(pool, body, actorId(request, role)),
      )
      response.status(201).json({ ok: true, row })
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/orders/facturacao/update', async (request: Request, response: Response) => {
    try {
      const body = facturacaoUpdateBodySchema.parse(request.body)
      const role = readUserRole(authorization, request.headers['x-user-role'])
      if (role === 'viewer') {
        throw new RouteError('forbidden', 403, 'Viewers may not update invoices.')
      }
      const connection = dependencies.resolveOrdersProfile()
      const row = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.updateFacturacao(pool, body.id, body.patch, actorId(request, role)),
      )
      if (!row) {
        throw new RouteError('not-found', 404, `Invoice ${body.id} was not found.`)
      }
      response.json({ ok: true, row })
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/orders/facturacao/delete', async (request: Request, response: Response) => {
    try {
      const body = facturacaoDeleteBodySchema.parse(request.body)
      const role = readUserRole(authorization, request.headers['x-user-role'])
      if (role === 'viewer') {
        throw new RouteError('forbidden', 403, 'Viewers may not delete invoices.')
      }
      const connection = dependencies.resolveOrdersProfile()
      const deleted = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.deleteFacturacao(pool, body.id),
      )
      if (!deleted) {
        throw new RouteError('not-found', 404, `Invoice ${body.id} was not found.`)
      }
      response.json({ ok: true })
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/orders/email', async (request: Request, response: Response) => {
    try {
      const body = emailDocumentsBodySchema.parse(request.body)
      const role = readUserRole(authorization, request.headers['x-user-role'])
      if (role === 'viewer') throw new RouteError('forbidden', 403, 'Viewers may not send email.')
      if (!dependencies.sendEmail)
        throw new RouteError('orders-not-configured', 503, 'Email is not configured.')

      const connection = dependencies.resolveOrdersProfile()
      const { order, documents } = await withPool(
        dependencies.openPool,
        connection,
        async (pool) => {
          const currentOrder = await dependencies.fetchOrderById(pool, body.orderId)
          const currentDocuments = await dependencies.fetchFacturacao(pool, body.orderId)
          return { order: currentOrder, documents: currentDocuments }
        },
      )
      if (!order) throw new RouteError('not-found', 404, `Order ${body.orderId} was not found.`)

      const selected = documents.filter(
        (document) =>
          body.documentIds.includes(document.ID_Facturacao) &&
          document.Imprimiu !== true &&
          document.E_Invoice !== true &&
          document.Imp_Block !== true,
      )
      if (selected.length !== body.documentIds.length) {
        throw new RouteError(
          'validation',
          400,
          'One or more selected documents are missing or are not eligible for sending.',
        )
      }
      const uploadedAttachments = validateAttachments(body.documentIds, body.attachments, body.attachmentNames)
      const recipient = await readTestRecipient()
      for (const document of selected) {
        const email = buildInvoiceEmail(order, document)
        const documentId = String(document.ID_Facturacao)
        const uploadedPdf = uploadedAttachments.get(documentId)
        const uploadedFilename = body.attachmentNames?.[documentId]
        const attachment = uploadedPdf
          ? {
              filename: safeFilename(
                uploadedFilename ||
                  document.Nome_PDF ||
                  `${document.N_Doc_FT || document.ID_Facturacao}.pdf`,
              ),
              content: uploadedPdf,
            }
          : await resolvePdfAttachment(document)
        await dependencies.sendEmail({
          to: recipient,
          ...email,
          attachments: attachment ? [attachment] : [],
        })
      }
      for (const document of selected) {
        const updated = await withPool(dependencies.openPool, connection, (pool) =>
          dependencies.updateFacturacao(pool, document.ID_Facturacao, { Imprimiu: true }, actorId(request, role)),
        )
        if (!updated) {
          throw new RouteError('not-found', 404, `Invoice ${document.ID_Facturacao} was not found.`)
        }
      }
      response.json({ ok: true, recipient, sent: selected.length })
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/orders/email-all', async (request: Request, response: Response) => {
    try {
      const body = emailAllDocumentsBodySchema.parse(request.body)
      const role = readUserRole(authorization, request.headers['x-user-role'])
      if (role === 'viewer') throw new RouteError('forbidden', 403, 'Viewers may not send email.')
      if (!dependencies.sendEmail)
        throw new RouteError('orders-not-configured', 503, 'Email is not configured.')
      if (!dependencies.fetchAllFacturacao)
        throw new RouteError('orders-not-configured', 503, 'Document email is unavailable.')
      const connection = dependencies.resolveOrdersProfile()
      const { documents, orders } = await withPool(
        dependencies.openPool,
        connection,
        async (pool) => {
          const allDocuments = await dependencies.fetchAllFacturacao!(pool)
          const selected = allDocuments.filter(
            (document) =>
              body.documentIds.includes(document.ID_Facturacao) &&
              document.Imprimiu !== true &&
              document.E_Invoice !== true &&
              document.Imp_Block !== true,
          )
          const orderRows = new Map<number, OrderDetailRow>()
          for (const document of selected) {
            const order = await dependencies.fetchOrderById(pool, document.ID_Order)
            if (order) orderRows.set(document.ID_Order, order)
          }
          return { documents: selected, orders: orderRows }
        },
      )
      if (
        documents.length !== body.documentIds.length ||
        orders.size !== new Set(documents.map((d) => d.ID_Order)).size
      ) {
        throw new RouteError(
          'validation',
          400,
          'One or more selected documents are missing or are not eligible for sending.',
        )
      }
      const uploadedAttachments = validateAttachments(body.documentIds, body.attachments, body.attachmentNames)
      for (const document of documents) {
        const order = orders.get(document.ID_Order)
        if (!order)
          throw new RouteError('not-found', 404, `Order ${document.ID_Order} was not found.`)
        const recipient = body.recipients?.[String(document.ID_Facturacao)]
        if (!recipient?.length)
          throw new RouteError(
            'validation',
            400,
            `No recipient email was selected for document ${document.ID_Facturacao}.`,
          )
        const email = buildInvoiceEmail(order, document)
        const uploadedPdf = uploadedAttachments.get(String(document.ID_Facturacao))
        const attachment = uploadedPdf
          ? {
              filename: document.Nome_PDF || `${document.N_Doc_FT || document.ID_Facturacao}.pdf`,
              content: uploadedPdf,
            }
          : await resolvePdfAttachment(document)
        await dependencies.sendEmail({
          to: recipient.join(','),
          ...email,
          attachments: attachment ? [attachment] : [],
        })
      }
      for (const document of documents) {
        await withPool(dependencies.openPool, connection, (pool) =>
          dependencies.updateFacturacao(
            pool,
            document.ID_Facturacao,
            {
              Imprimiu: true,
              Nome_PDF:
                safeOptionalFilename(body.attachmentNames?.[String(document.ID_Facturacao)]) ??
                document.Nome_PDF ??
                (document.N_Doc_FT ? `${document.N_Doc_FT}.pdf` : null),
            },
            role,
          ),
        )
      }
      response.json({ ok: true, recipient: 'selected recipients', sent: documents.length })
    } catch (error) {
      sendError(response, error)
    }
  })

  // Kit_Consumables sub-table — consumables drawn against a Kit order's Kit_Amount.
  // The Saldo (Kit_Amount − Σ Total_Price) is computed client-side for display; the
  // server applies no capacity constraint here (it is informational, not a hard limit).
  router.get('/api/orders/kit-consumables', async (request: Request, response: Response) => {
    try {
      const orderId = orderIdQueryParamSchema.parse(request.query.orderId)
      const connection = dependencies.resolveOrdersProfile()
      const rows = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchKitConsumables(pool, orderId),
      )
      const payload: OkKitConsumables = { ok: true, rows }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post('/api/orders/kit-consumables', async (request: Request, response: Response) => {
    try {
      const body = kitConsumableCreateBodySchema.parse(request.body)
      const role = readUserRole(authorization, request.headers['x-user-role'])
      if (role === 'viewer') {
        throw new RouteError('forbidden', 403, 'Viewers may not add kit consumables.')
      }
      const connection = dependencies.resolveOrdersProfile()
      const row = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.addKitConsumable(pool, body),
      )
      response.status(201).json({ ok: true, row })
    } catch (error) {
      sendError(response, error)
    }
  })

  router.post(
    '/api/orders/kit-consumables/update',
    async (request: Request, response: Response) => {
      try {
        const body = kitConsumableUpdateBodySchema.parse(request.body)
        const role = readUserRole(authorization, request.headers['x-user-role'])
        if (role === 'viewer') {
          throw new RouteError('forbidden', 403, 'Viewers may not update kit consumables.')
        }
        const connection = dependencies.resolveOrdersProfile()
        const row = await withPool(dependencies.openPool, connection, (pool) =>
          dependencies.updateKitConsumable(pool, body.id, body.patch),
        )
        if (!row) {
          throw new RouteError('not-found', 404, `Kit consumable ${body.id} was not found.`)
        }
        response.json({ ok: true, row })
      } catch (error) {
        sendError(response, error)
      }
    },
  )

  router.post(
    '/api/orders/kit-consumables/delete',
    async (request: Request, response: Response) => {
      try {
        const body = kitConsumableDeleteBodySchema.parse(request.body)
        const role = readUserRole(authorization, request.headers['x-user-role'])
        if (role === 'viewer') {
          throw new RouteError('forbidden', 403, 'Viewers may not delete kit consumables.')
        }
        const connection = dependencies.resolveOrdersProfile()
        const deleted = await withPool(dependencies.openPool, connection, (pool) =>
          dependencies.deleteKitConsumable(pool, body.id),
        )
        if (!deleted) {
          throw new RouteError('not-found', 404, `Kit consumable ${body.id} was not found.`)
        }
        response.json({ ok: true })
      } catch (error) {
        sendError(response, error)
      }
    },
  )

  return router
}

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024
const MAX_ATTACHMENT_TOTAL_BYTES = 18 * 1024 * 1024

function validateAttachments(
  documentIds: number[],
  attachments: Record<string, string> | undefined,
  attachmentNames: Record<string, string> | undefined,
): Map<string, Buffer> {
  const allowed = new Set(documentIds.map(String))
  for (const key of [...Object.keys(attachments ?? {}), ...Object.keys(attachmentNames ?? {})]) {
    if (!allowed.has(key)) throw new RouteError('validation', 400, 'Attachment keys must match selected documents.')
  }
  const decoded = new Map<string, Buffer>()
  let total = 0
  for (const [key, value] of Object.entries(attachments ?? {})) {
    const match = /^data:application\/pdf;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
    if (!match || match[1].length % 4 !== 0) {
      throw new RouteError('validation', 400, 'Attachments must be valid PDF data URIs.')
    }
    const content = Buffer.from(match[1], 'base64')
    if (content.length < 5 || content.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new RouteError('validation', 400, 'Attachments must contain a valid PDF file.')
    }
    if (content.length > MAX_ATTACHMENT_BYTES || (total += content.length) > MAX_ATTACHMENT_TOTAL_BYTES) {
      throw new RouteError('validation', 400, 'Attachments exceed the permitted size.')
    }
    decoded.set(key, content)
  }
  return decoded
}

function safeFilename(value: string): string {
  const filename = value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  const basename = filename.split(/[\\/]/).pop() ?? ''
  if (!basename || basename === '.' || basename === '..') return 'document.pdf'
  return basename.slice(0, 255)
}

function safeOptionalFilename(value: string | undefined): string | null {
  return value === undefined ? null : safeFilename(value)
}
