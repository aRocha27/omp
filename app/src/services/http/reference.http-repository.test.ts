/**
 * Unit tests for HttpReferenceRepository.
 *
 * Global `fetch` is mocked — no network. Mirrors `clients.http-repository.test.ts`:
 * covers the three cascade read endpoints (with and without the parent filter), and
 * the failure → RepositoryError mapping (502 not-configured → server-error,
 * 401/403 → forbidden, network → server-error).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { HttpReferenceRepository } from '@/services/http/reference.http-repository'
import { RepositoryError } from '@/services/contracts/reference.repository'
import type {
  AreaOption,
  InstrumentoOption,
  ProdutoOption,
} from '@/domain/models/reference-cascade'

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

const areaRows: AreaOption[] = [
  { id: 'BDAL', label: 'BDAL' },
  { id: 'BOPT', label: 'BOPT' },
]
const produtoRows: ProdutoOption[] = [
  { id: 5, label: 'LAB GC / SQ-MS Service', area: 'BDAL' },
  { id: 1, label: 'MIR', area: 'BOPT' },
]
const instrumentoRows: InstrumentoOption[] = [
  { id: 4, label: 'GC 43X', produto: 5 },
  { id: 1, label: 'VERTEX 70', produto: 1 },
]

describe('HttpReferenceRepository', () => {
  let repo: HttpReferenceRepository
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    repo = new HttpReferenceRepository()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('GETs /areas and returns the area list', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, areas: areaRows }))

    const rows = await repo.listAreas()

    expect(rows).toEqual(areaRows)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/areas')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init?.method).toBe('GET')
  })

  it('GETs /produtos?area=XX when an area filter is provided', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, produtos: produtoRows }))

    const rows = await repo.listProdutos('BDAL')

    expect(rows).toEqual(produtoRows)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/produtos?area=BDAL')
  })

  it('GETs /produtos without a query string when no area filter is provided', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, produtos: produtoRows }))

    await repo.listProdutos()

    expect(fetchMock.mock.calls[0][0]).toBe('/api/produtos')
  })

  it('GETs /instrumentos?produto=N when a produto filter is provided', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { ok: true, instrumentos: instrumentoRows }),
    )

    const rows = await repo.listInstrumentos(5)

    expect(rows).toEqual(instrumentoRows)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/instrumentos?produto=5')
  })

  it('GETs /instrumentos without a query string when no produto filter is provided', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { ok: true, instrumentos: instrumentoRows }),
    )

    await repo.listInstrumentos()

    expect(fetchMock.mock.calls[0][0]).toBe('/api/instrumentos')
  })

  it('maps a not-configured failure (502) to a server-error RepositoryError', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(502, { ok: false, code: 'orders-not-configured', message: 'No profile.' }),
    )

    const error = await repo.listAreas().catch((e) => e)
    expect(error).toBeInstanceOf(RepositoryError)
    expect(error).toMatchObject({ kind: 'server-error', message: 'No profile.' })
  })

  it('maps a 401/403 to a forbidden RepositoryError', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { ok: false, code: 'unauthorized', message: 'no token' }),
    )

    await expect(repo.listAreas()).rejects.toMatchObject({
      kind: 'forbidden',
      message: 'no token',
    })
  })

  it('maps a network failure to a server-error RepositoryError', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))

    await expect(repo.listAreas()).rejects.toMatchObject({ kind: 'server-error' })
  })
})