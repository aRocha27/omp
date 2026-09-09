/**
 * Unit tests for MockReferenceRepository.
 *
 * Direct instantiation — no React, no providers. Covers the cascade filtering
 * semantics against the enriched reference-data fixtures: every row when no parent
 * filter is set, only the parent's children when it is.
 */
import { describe, it, expect } from 'vitest'
import { MockReferenceRepository } from '@/services/mock/reference.mock-repository'
import { areas, instrumentos, produtos } from '@/fixtures/reference-data'

describe('MockReferenceRepository', () => {
  const repo = new MockReferenceRepository()

  it('returns every area when listAreas is called', async () => {
    const rows = await repo.listAreas()
    expect(rows).toEqual(areas.map((o) => ({ ...o })))
  })

  it('returns every produto when listProdutos is called without a filter', async () => {
    const rows = await repo.listProdutos()
    expect(rows).toHaveLength(produtos.length)
    expect(rows.map((r) => r.id)).toEqual(produtos.map((p) => p.id))
  })

  it('returns only the BDAL produtos when filtered by area=BDAL', async () => {
    const rows = await repo.listProdutos('BDAL')
    // BDAL produtos are 5–11; BOPT produtos (1,2,3,12,13) are excluded.
    expect(rows.every((r) => r.area === 'BDAL')).toBe(true)
    expect(rows.map((r) => r.id).sort((a, b) => a - b)).toEqual([5, 6, 7, 8, 9, 10, 11])
  })

  it('returns only the BOPT produtos when filtered by area=BOPT', async () => {
    const rows = await repo.listProdutos('BOPT')
    expect(rows.every((r) => r.area === 'BOPT')).toBe(true)
    expect(rows.map((r) => r.id).sort((a, b) => a - b)).toEqual([1, 2, 3, 12, 13])
  })

  it('returns every instrumento when listInstrumentos is called without a filter', async () => {
    const rows = await repo.listInstrumentos()
    expect(rows).toHaveLength(instrumentos.length)
  })

  it('returns only the instrumentos whose produto matches the filter', async () => {
    const rows = await repo.listInstrumentos(6)
    // Every fixture instrumento with produto=6: ids 2,7,12,17,27.
    expect(rows.every((r) => r.produto === 6)).toBe(true)
    expect(rows.map((r) => r.id).sort((a, b) => a - b)).toEqual([2, 7, 12, 17, 27])
  })

  it('returns an empty array when no child matches the parent filter', async () => {
    expect(await repo.listProdutos('NOPE')).toEqual([])
    expect(await repo.listInstrumentos(999999)).toEqual([])
  })

  it('returns defensive copies (mutating a result does not affect the fixture)', async () => {
    const rows = await repo.listProdutos('BDAL')
    rows[0].label = 'tampered'
    const fresh = await repo.listProdutos('BDAL')
    expect(fresh[0].label).not.toBe('tampered')
  })
})