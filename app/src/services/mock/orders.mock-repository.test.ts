/**
 * Unit tests for MockOrdersRepository.
 *
 * Direct instantiation — no React, no providers. Covers the search filter
 * semantics (including the null-row regression for fixture 1006) and the
 * `getById` detail path.
 */
import { describe, it, expect } from 'vitest'
import { MockOrdersRepository } from '@/services/mock/orders.mock-repository'
import { MockReconhecimentoRepository } from '@/services/mock/reconhecimento.mock-repository'
import { MockDocumentoFaturacaoRepository } from '@/services/mock/documento-faturacao.mock-repository'
import { MockDataStore } from '@/services/mock/mock-data-store'
import { RepositoryError } from '@/services/contracts/orders.repository'

describe('MockOrdersRepository', () => {
  const repo = new MockOrdersRepository()

  describe('search', () => {
    it('returns all 7 rows by default, newest-first (DT_Order DESC, ID_Order DESC)', async () => {
      const rows = await repo.search({})
      expect(rows).toHaveLength(7)
      const ids = rows.map((r) => r.ID_Order)
      // 1007 (2025-10-10) newest; then the 1001 & 1002 tie on 2025-09-12 (higher ID first),
      // then 1003, 1004, 1005, 1006.
      expect(ids).toEqual([1007, 1002, 1001, 1003, 1004, 1005, 1006])
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

    it('uses contains-match for invoiceNumber through Facturacao.ID_Order', async () => {
      const rows = await repo.search({ invoiceNumber: '2025/000' })
      const ids = rows.map((r) => r.ID_Order)
      expect(ids).toEqual([1002, 1001])
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
      // 1007 (2025-10-10) and 1001 & 1002 (2025-09-12); 1006 is 2025-06-04 (excluded).
      expect(ids).toEqual([1007, 1002, 1001])
      expect(ids).not.toContain(1006)
    })

    it('filters by dateTo inclusive (exact-boundary date kept)', async () => {
      // dateTo == 1003's DT_Order (2025-08-30) — inclusive boundary.
      const rows = await repo.search({ dateTo: '2025-08-30' })
      const ids = rows.map((r) => r.ID_Order)
      // 1001 & 1002 (2025-09-12) excluded; 1003 kept on the boundary.
      expect(ids).toEqual([1003, 1004, 1005, 1006])
      expect(ids).not.toContain(1001)
      expect(ids).not.toContain(1002)
    })

    it('filters by dateFrom + dateTo combined (closed range)', async () => {
      const rows = await repo.search({ dateFrom: '2025-08-01', dateTo: '2025-08-31' })
      const ids = rows.map((r) => r.ID_Order)
      // Only 1003 (08-30) and 1004 (08-15) fall in August 2025.
      expect(ids).toEqual([1003, 1004])
    })

    it('returns an empty array when no rows match', async () => {
      const rows = await repo.search({ idProduto: [99999] })
      expect(rows).toEqual([])
    })

    it('returns a sliced page when pagination is requested', async () => {
      const rows = await repo.search({}, { limit: 2, offset: 1 })
      expect(rows.map((r) => r.ID_Order)).toEqual([1002, 1001])
    })

    it('filters by idArea and excludes the null-row 1006', async () => {
      const area1 = (await repo.search({ idArea: ['BDAL'] })).map((r) => r.ID_Order)
      expect(area1).toEqual([1002, 1001, 1005])
      expect(area1).not.toContain(1006)

      const area2 = (await repo.search({ idArea: ['BOPT'] })).map((r) => r.ID_Order)
      expect(area2).toEqual([1007, 1003, 1004])
    })

    it('filters by idProduto and excludes the null-row 1006', async () => {
      const rows = (await repo.search({ idProduto: [10] })).map((r) => r.ID_Order)
      expect(rows).toEqual([1001, 1005])
      expect(rows).not.toContain(1006)
    })

    it('filters by idInstrumento and excludes null-instrument rows', async () => {
      // 1004 and 1006 have null ID_Instrumento.
      const rows = (await repo.search({ idInstrumento: [1] })).map((r) => r.ID_Order)
      expect(rows).toEqual([1001])
      expect(rows).not.toContain(1004)
      expect(rows).not.toContain(1006)
    })

    it('filters by idTpOrder and excludes the null-row 1006', async () => {
      const com = (await repo.search({ idTpOrder: ['COM'] })).map((r) => r.ID_Order)
      expect(com).toEqual([1002, 1003])

      const client = (await repo.search({ idTpOrder: ['C'] })).map((r) => r.ID_Order)
      expect(client).toEqual([1007, 1001, 1004, 1005])
      expect(client).not.toContain(1006)
    })

    it('filters by idTipo and excludes the null-row 1006', async () => {
      const instr = (await repo.search({ idTipo: ['INSTR'] })).map((r) => r.ID_Order)
      expect(instr).toEqual([1002, 1001, 1005])
      expect(instr).not.toContain(1006)

      const acess = (await repo.search({ idTipo: ['ACESS'] })).map((r) => r.ID_Order)
      expect(acess).toEqual([1003, 1004])
      expect(acess).not.toContain(1006)
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
      expect(order?.Orc_Proposta).toBe('ORC-1001')
      expect(order?.ID_Tp_Warranty).toBe(1)
      expect(order?.Warranty_Reserve).toBe(1455)
      expect(order?.ID_Tp_Revenue).toBe(1)
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

  describe('update', () => {
    it('applies a patch and persists it for a subsequent getById', async () => {
      // Fixture 1001 starts at Sell_Price 48500 (see fixtures/orders.ts).
      const before = await repo.getById(1001)
      expect(before?.Sell_Price).toBe(48500)

      const updated = await repo.update(1001, { Sell_Price: 51200 }, 'editor')
      expect(updated.ID_Order).toBe(1001)
      expect(updated.Sell_Price).toBe(51200)

      // The mock mutates the fixture entry in place, so the next read sees the
      // new value (mirrors how the live DB persists the update).
      const after = await repo.getById(1001)
      expect(after?.Sell_Price).toBe(51200)
    })

    it('throws a not-found RepositoryError for an unknown id', async () => {
      const error = await repo.update(99999, { Sell_Price: 1 }, 'admin').catch((e) => e)
      expect(error).toBeInstanceOf(RepositoryError)
      expect(error).toMatchObject({ kind: 'not-found', message: 'Order not found.' })
    })

    it('rejects viewer mutations before changing the order', async () => {
      const before = await repo.getById(1004)
      await expect(repo.update(1004, { Obs: 'forbidden' }, 'viewer')).rejects.toMatchObject({
        kind: 'forbidden',
      })
      expect(await repo.getById(1004)).toEqual(before)
    })
  })

  describe('shared mutable state', () => {
    it('makes an updated Sell Price authoritative for recognition and invoicing writes', async () => {
      const store = new MockDataStore()
      const ordersRepo = new MockOrdersRepository(store)
      const recognitionRepo = new MockReconhecimentoRepository(store)
      const invoicingRepo = new MockDocumentoFaturacaoRepository(store)

      await ordersRepo.update(1004, { Sell_Price: 1_000 }, 'editor')

      await expect(
        recognitionRepo.add(
          {
            ID_Order: 1004,
            ID_Tp_Reconhecimento: 'P',
            DT_Reconhecimento: '2025-11-01T00:00:00Z',
            Valor_Reconhecimento: 1_001,
          },
          'editor',
        ),
      ).rejects.toMatchObject({
        message: 'Total recognised cannot exceed the Sell Price.',
      })
      await expect(
        invoicingRepo.add(
          {
            ID_Order: 1004,
            ID_Tp_Doc_FT: 'FT',
            N_Doc_FT: 'FT shared state',
            DT_Doc_FT: '2025-11-01T00:00:00Z',
            Valor_Doc_FT: 1_001,
          },
          'editor',
        ),
      ).rejects.toMatchObject({
        message: 'Net invoiced cannot exceed the Sell Price.',
      })
    })

    it('rejects an order update that would invalidate existing recognition rows', async () => {
      const store = new MockDataStore()
      const ordersRepo = new MockOrdersRepository(store)

      await expect(ordersRepo.update(1001, { Sell_Price: 35_000 }, 'editor')).rejects.toMatchObject(
        {
          message: 'Total recognised cannot exceed the Sell Price.',
        },
      )
      expect((await ordersRepo.getById(1001))?.Sell_Price).toBe(48_500)
    })

    it('recomputes Tipo_Warranty from ID_Tipo and ignores a stale reserve for CM capacity', async () => {
      const store = new MockDataStore()
      const ordersRepo = new MockOrdersRepository(store)
      const recognitionRepo = new MockReconhecimentoRepository(store)

      await ordersRepo.update(1004, { Warranty_Reserve: 500 }, 'editor')
      const updated = await ordersRepo.update(1004, { ID_Tipo: 'CM' }, 'editor')

      expect(updated.Tipo_Warranty).toBe(false)
      await expect(
        recognitionRepo.add(
          {
            ID_Order: 1004,
            ID_Tp_Reconhecimento: 'P',
            DT_Reconhecimento: '2025-11-01T00:00:00Z',
            Valor_Reconhecimento: 39_500,
          },
          'editor',
        ),
      ).resolves.toMatchObject({ Valor_Reconhecimento: 39_500 })
    })

    it('makes newly created orders immediately available to subtable repositories', async () => {
      const store = new MockDataStore()
      const ordersRepo = new MockOrdersRepository(store)
      const recognitionRepo = new MockReconhecimentoRepository(store)

      const created = await ordersRepo.create(
        {
          DT_Order: '2025-11-01T00:00:00Z',
          ID_Tp_Order: 'C',
          ID_Area: 'BOPT',
          ID_Tipo: 'CM',
          ID_Produto: 13,
          Sell_Price: 1_200,
        },
        'editor',
      )

      await expect(
        recognitionRepo.add(
          {
            ID_Order: created.ID_Order,
            ID_Tp_Reconhecimento: 'CM',
            DT_Reconhecimento: '2025-11-01T00:00:00Z',
            Valor_Reconhecimento: 1_200,
          },
          'editor',
        ),
      ).resolves.toMatchObject({ ID_Order: created.ID_Order })
    })

    it('rejects an order update that would invalidate existing invoicing rows', async () => {
      const store = new MockDataStore()
      const ordersRepo = new MockOrdersRepository(store)
      const invoicingRepo = new MockDocumentoFaturacaoRepository(store)
      const created = await ordersRepo.create(
        {
          DT_Order: '2025-11-01T00:00:00Z',
          ID_Tp_Order: 'C',
          ID_Area: 'BOPT',
          ID_Tipo: 'CM',
          ID_Produto: 13,
          Sell_Price: 1_000,
        },
        'editor',
      )
      await invoicingRepo.add(
        {
          ID_Order: created.ID_Order,
          ID_Tp_Doc_FT: 'FT',
          N_Doc_FT: 'FT update guard',
          DT_Doc_FT: '2025-11-01T00:00:00Z',
          Valor_Doc_FT: 800,
        },
        'editor',
      )

      await expect(
        ordersRepo.update(created.ID_Order, { Sell_Price: 700 }, 'editor'),
      ).rejects.toMatchObject({
        message: 'Net invoiced cannot exceed the Sell Price.',
      })
      expect((await ordersRepo.getById(created.ID_Order))?.Sell_Price).toBe(1_000)
    })
  })
})
