import { Router, type Request, type Response } from 'express'
import type { ConnectionPool } from 'mssql'
import type {
  ConnectionConfig,
  DocumentoFaturacaoRow,
  DocumentoFaturacaoTypeRow,
  OkFacturacao,
  OkOrder,
  OkOrders,
  OkOrderUpdate,
  OkOrderCreate,
  OkReconhecimentos,
  OrderDetailRow,
  OrderSummaryRow,
  OrderUpdateChanges,
  OrderCreateInput,
  ReconhecimentoRow,
  NewReconhecimentoInput,
  NewFacturacaoInput,
  ReconhecimentoPatch,
  FacturacaoPatch,
  PropagateReconhecimentoInput,
} from '../types.js'
import { isHistoricoRow, isLockedCaracterizacaoField, type OrderListFilters } from '../db.js'
import {
  orderIdQueryParamSchema,
  ordersListBodySchema,
  orderIdParamSchema,
  orderCreateBodySchema,
  orderUpdateBodySchema,
  reconhecimentoCreateBodySchema,
  reconhecimentoDeleteBodySchema,
  reconhecimentoPropagateBodySchema,
  reconhecimentoUpdateBodySchema,
  facturacaoCreateBodySchema,
  facturacaoDeleteBodySchema,
  facturacaoUpdateBodySchema,
} from '../validation.js'
import { RouteError, sendError, withPool } from './http-errors.js'

// The Orders tab never sends credentials — it reads through a server-configured managed
// profile (password in env). These are the only collaborators the router needs.
export interface OrdersDependencies {
  resolveOrdersProfile: () => ConnectionConfig
  openPool: (connection: ConnectionConfig) => Promise<ConnectionPool>
  fetchOrderSummaries: (
    pool: ConnectionPool,
    filters: OrderListFilters,
    limit: number,
  ) => Promise<OrderSummaryRow[]>
  fetchOrderById: (pool: ConnectionPool, id: number) => Promise<OrderDetailRow | null>
  updateOrder: (
    pool: ConnectionPool,
    id: number,
    changes: OrderUpdateChanges,
  ) => Promise<OrderDetailRow | null>
  createOrder: (
    pool: ConnectionPool,
    input: OrderCreateInput,
    user: string,
  ) => Promise<OrderDetailRow>
  fetchReconhecimentos: (pool: ConnectionPool, orderId: number) => Promise<ReconhecimentoRow[]>
  fetchFacturacao: (pool: ConnectionPool, orderId: number) => Promise<DocumentoFaturacaoRow[]>
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
        dependencies.fetchOrderSummaries(pool, body.filters, body.limit),
      )
      const payload: OkOrders = { ok: true, orders }
      response.json(payload)
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
      if (role !== 'admin' && isHistoricoRow(current)) {
        const locked = Object.keys(body.patch).filter(isLockedCaracterizacaoField)
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
          user: role,
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

  router.post('/api/orders', async (request: Request, response: Response) => {
    try {
      const body = orderCreateBodySchema.parse(request.body) as OrderCreateInput
      const role = readUserRole(authorization, request.headers['x-user-role'])
      if (role === 'viewer')
        throw new RouteError('forbidden', 403, 'Viewers may not create orders.')
      const connection = dependencies.resolveOrdersProfile()
      const order = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.createOrder(pool, body, role),
      )
      const payload: OkOrderCreate = { ok: true, order }
      response.status(201).json(payload)
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

  router.post('/api/orders/reconhecimentos', async (request: Request, response: Response) => {
    try {
      const body = reconhecimentoCreateBodySchema.parse(request.body)
      const role = readUserRole(authorization, request.headers['x-user-role'])
      if (role === 'viewer')
        throw new RouteError('forbidden', 403, 'Viewers may not add recognition.')
      const connection = dependencies.resolveOrdersProfile()
      const row = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.addReconhecimento(pool, body, role),
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
          dependencies.updateReconhecimento(pool, body.id, body.patch, role),
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
          dependencies.propagateReconhecimento(pool, body, role),
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
        dependencies.addFacturacao(pool, body, role),
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
        dependencies.updateFacturacao(pool, body.id, body.patch, role),
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

  return router
}
