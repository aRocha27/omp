import { Router, type Request, type Response } from 'express'
import type { ConnectionPool } from 'mssql'
import type {
  AreaRow,
  ConnectionConfig,
  InstrumentoRow,
  OkAreas,
  OkInstrumentos,
  OkProdutos,
  ProdutoRow,
} from '../types.js'
import { areaQueryParamSchema, produtoQueryParamSchema } from '../validation.js'
import { sendError, withPool } from './http-errors.js'

// Reference data for the Área → Produto → Instrumento cascade. Read-only, shares the Orders
// managed profile (no client credentials). The endpoints power the dependent dropdowns in the
// create/detail forms; the optional `area`/`produto` query params narrow the cascade, and their
// absence returns every row for the non-cascaded list filters.
export interface ReferenceDependencies {
  resolveOrdersProfile: () => ConnectionConfig
  openPool: (connection: ConnectionConfig) => Promise<ConnectionPool>
  fetchAreas: (pool: ConnectionPool) => Promise<AreaRow[]>
  fetchProdutos: (pool: ConnectionPool, area?: string) => Promise<ProdutoRow[]>
  fetchInstrumentos: (pool: ConnectionPool, produto?: number) => Promise<InstrumentoRow[]>
}

export function createReferenceRouter(dependencies: ReferenceDependencies): Router {
  const router = Router()

  router.get('/api/areas', async (_request: Request, response: Response) => {
    try {
      const connection = dependencies.resolveOrdersProfile()
      const areas = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchAreas(pool),
      )
      const payload: OkAreas = { ok: true, areas }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.get('/api/produtos', async (request: Request, response: Response) => {
    try {
      const area = areaQueryParamSchema.parse(request.query.area)
      const connection = dependencies.resolveOrdersProfile()
      const produtos = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchProdutos(pool, area),
      )
      const payload: OkProdutos = { ok: true, produtos }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  router.get('/api/instrumentos', async (request: Request, response: Response) => {
    try {
      const produto = produtoQueryParamSchema.parse(request.query.produto)
      const connection = dependencies.resolveOrdersProfile()
      const instrumentos = await withPool(dependencies.openPool, connection, (pool) =>
        dependencies.fetchInstrumentos(pool, produto),
      )
      const payload: OkInstrumentos = { ok: true, instrumentos }
      response.json(payload)
    } catch (error) {
      sendError(response, error)
    }
  })

  return router
}