/**
 * Unit tests for MockOrdersRepository.
 *
 * Direct instantiation — no React, no providers. Covers the search filter
 * semantics (including the null-row regression for fixture 1006) and the
 * `getById` detail path.
 */
import { describe, it, expect } from 'vitest'
import { MockOrdersRepository } from '@/services/mock/orders.mock-repository'

describe('MockOrdersRepository', () => {
  const repo = new MockOrdersRepository()

  describe('search', () => {
    it('returns all 6 rows by default, newest-first (DT_Order DESC, ID_Order DESC)', async () => {
      const rows = await repo.search({})
      expect(rows).toHaveLength(6)
      const ids = rows.map((r) => r.ID_Order)
      // Same-date ties (1001 & 1002 on 2025-09-12) break by higher ID_Order first.
      expect(ids).toEqual([1002, 1001, 1003, 1004, 1005, 1006])
    })

    it('excludes the null-row 1006 when clientName filter is set (null-row regression)', async () => {
      const rows = await repo.search({ clientName: 'Alpha' })
      const ids = rows.map((r) => r.ID_Order)
      // Only 1001 and 1005 belong to Client Alpha; 1006 (Client_Name null) is excluded.
      expect(ids).toEqual([1001, 1005])
      expect(ids).not.toContain(1006)
    })

    it('uses contains-match for encomendaCliPHC and excludes null rows', async () => {
      const rows = await repo.search({ encomendaCliPHC: '1001' })
      const ids = rows.map((r) => r.ID_Order)
      expect(ids).toEqual([1001])
      expect(ids).not.toContain(1006)
    })

    it('filters by orderFactory=true (excludes 1006 null)', async () => {
      const rows = await repo.search({ orderFactory: true })
      const ids = rows.map((r) => r.ID_Order)
      expect(ids).toEqual([1002, 1003])
      expect(ids).not.toContain(1006)
    })

    it('filters by negocioFechado=true (only the closed deal)', async () => {
      const rows = await repo.search({ negocioFechado: true })
      const ids = rows.map((r) => r.ID_Order)
      expect(ids).toEqual([1002])
    })

    it('filters by dateFrom inclusive', async () => {
      const rows = await repo.search({ dateFrom: '2025-09-01' })
      const ids = rows.map((r) => r.ID_Order)
      // 1001 & 1002 are 2025-09-12; 1006 is 2025-06-04 (excluded by date).
      expect(ids).toEqual([1002, 1001])
      expect(ids).not.toContain(1006)
    })

    it('returns an empty array when no rows match', async () => {
      const rows = await repo.search({ idProduto: 99999 })
      expect(rows).toEqual([])
    })

    it('filters by idArea and excludes the null-row 1006', async () => {
      const area1 = (await repo.search({ idArea: 1 })).map((r) => r.ID_Order)
      expect(area1).toEqual([1002, 1001, 1005])
      expect(area1).not.toContain(1006)

      const area2 = (await repo.search({ idArea: 2 })).map((r) => r.ID_Order)
      expect(area2).toEqual([1003, 1004])
    })

    it('filters by idProduto and excludes the null-row 1006', async () => {
      const rows = (await repo.search({ idProduto: 10 })).map((r) => r.ID_Order)
      expect(rows).toEqual([1001, 1005])
      expect(rows).not.toContain(1006)
    })

    it('filters by idInstrumento and excludes null-instrument rows', async () => {
      // 1004 and 1006 have null ID_Instrumento.
      const rows = (await repo.search({ idInstrumento: 200 })).map((r) => r.ID_Order)
      expect(rows).toEqual([1001])
      expect(rows).not.toContain(1004)
      expect(rows).not.toContain(1006)
    })

    it('filters by idTpOrder and excludes the null-row 1006', async () => {
      const fab = (await repo.search({ idTpOrder: 'FAB' })).map((r) => r.ID_Order)
      expect(fab).toEqual([1002, 1003])

      const std = (await repo.search({ idTpOrder: 'STD' })).map((r) => r.ID_Order)
      expect(std).toEqual([1001, 1004, 1005])
      expect(std).not.toContain(1006)
    })
  })

  describe('getById', () => {
    it('returns the full Order for a known id with all §10 fields present', async () => {
      const order = await repo.getById(1001)
      expect(order).not.toBeNull()
      expect(order?.ID_Order).toBe(1001)
      // Spot-check a representative set of §10 fields.
      expect(order?.DT_Order).toBe('2025-09-12')
      expect(order?.ID_Client).toBe(501)
      expect(order?.Sell_Price).toBe(48500)
      expect(order?.Encomenda_Cli_PHC).toBe('PHC-1001')
      expect(order?.Negocio_Fechado).toBe(false)
      expect(order?.Orc_Proposta).toBe(47000)
      expect(order?.ID_Tp_Warranty).toBe('STD')
      expect(order?.Warranty_Reserve).toBe(1455)
      expect(order?.ID_Tp_Revenue).toBe('REV-STD')
      expect(order?.Facturado).toBe(false)
      expect(order?.Reconhecido).toBe(false)
      expect(order?.Kit).toBe(false)
      expect(order?.upsize_ts).toBeNull()
      expect(order?.Email).toBe('alice@demo-alpha.example')
    })

    it('returns the full Order for the null-row 1006 with optional fields null', async () => {
      const order = await repo.getById(1006)
      expect(order).not.toBeNull()
      expect(order?.ID_Order).toBe(1006)
      expect(order?.DT_Order).toBe('2025-06-04')
      expect(order?.ID_Client).toBeNull()
      expect(order?.Sell_Price).toBeNull()
      expect(order?.Negocio_Fechado).toBeNull()
      expect(order?.Encomenda_Cli_PHC).toBeNull()
    })

    it('returns null for an unknown id', async () => {
      const order = await repo.getById(99999)
      expect(order).toBeNull()
    })
  })
})