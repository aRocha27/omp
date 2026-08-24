import { describe, it, expect } from 'vitest'
import { toSearchFilters, type OrdersFiltersValue } from '@/features/orders/components/orders-filters'

describe('toSearchFilters', () => {
  const base: OrdersFiltersValue = {
    clientName: '',
    orderFactory: false,
    idTpOrder: [],
    idArea: [],
    idTipo: [],
    idProduto: [],
    idInstrumento: [],
    encomendaCliPHC: '',
    negocioFechado: false,
    dateFrom: '',
    dateTo: '',
  }

  it('maps an empty bar to all-null filters (no filtering)', () => {
    expect(toSearchFilters(base)).toEqual({
      clientName: null,
      orderFactory: null,
      idTpOrder: null,
      idArea: null,
      idTipo: null,
      idProduto: null,
      idInstrumento: null,
      encomendaCliPHC: null,
      negocioFechado: null,
      dateFrom: null,
      dateTo: null,
    })
  })

  it('passes the area and tipo string code arrays through verbatim', () => {
    const filters = toSearchFilters({ ...base, idArea: ['BDAL'], idTipo: ['INSTR'] })
    expect(filters.idArea).toEqual(['BDAL'])
    expect(filters.idTipo).toEqual(['INSTR'])
    expect(Array.isArray(filters.idArea)).toBe(true)
  })

  it('passes the numeric product and instrument id arrays through verbatim', () => {
    const filters = toSearchFilters({
      ...base,
      idProduto: [11],
      idInstrumento: [8],
    })
    expect(filters.idProduto).toEqual([11])
    expect(filters.idInstrumento).toEqual([8])
    expect(Array.isArray(filters.idProduto)).toBe(true)
  })

  it('maps boolean checkboxes to true and unchecked to null', () => {
    expect(toSearchFilters({ ...base, orderFactory: true }).orderFactory).toBe(true)
    expect(toSearchFilters({ ...base, orderFactory: false }).orderFactory).toBeNull()
    expect(toSearchFilters({ ...base, negocioFechado: true }).negocioFechado).toBe(true)
    expect(toSearchFilters({ ...base, negocioFechado: false }).negocioFechado).toBeNull()
  })

  it('trims text filters, treats whitespace-only as null, and passes code arrays through', () => {
    expect(toSearchFilters({ ...base, clientName: '  Alpha  ' }).clientName).toBe('Alpha')
    expect(toSearchFilters({ ...base, clientName: '   ' }).clientName).toBeNull()
    expect(toSearchFilters({ ...base, idTpOrder: ['COM'] }).idTpOrder).toEqual(['COM'])
  })
})