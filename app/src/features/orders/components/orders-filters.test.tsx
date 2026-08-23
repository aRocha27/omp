import { describe, it, expect } from 'vitest'
import { toSearchFilters, type OrdersFiltersValue } from '@/features/orders/components/orders-filters'

describe('toSearchFilters', () => {
  const base: OrdersFiltersValue = {
    clientName: '',
    orderFactory: '',
    idTpOrder: '',
    idArea: '',
    idProduto: '',
    idInstrumento: '',
    encomendaCliPHC: '',
    negocioFechado: '',
    dateFrom: '',
    dateTo: '',
  }

  it('maps an empty bar to all-null filters (no filtering)', () => {
    expect(toSearchFilters(base)).toEqual({
      clientName: null,
      orderFactory: null,
      idTpOrder: null,
      idArea: null,
      idProduto: null,
      idInstrumento: null,
      encomendaCliPHC: null,
      negocioFechado: null,
      dateFrom: null,
      dateTo: null,
    })
  })

  it('converts numeric dropdown ids from string to number', () => {
    const filters = toSearchFilters({
      ...base,
      idArea: '2',
      idProduto: '11',
      idInstrumento: '201',
    })
    expect(filters.idArea).toBe(2)
    expect(filters.idProduto).toBe(11)
    expect(filters.idInstrumento).toBe(201)
    expect(typeof filters.idArea).toBe('number')
  })

  it('maps boolean dropdowns to true/false and empty to null', () => {
    expect(toSearchFilters({ ...base, orderFactory: 'true' }).orderFactory).toBe(true)
    expect(toSearchFilters({ ...base, orderFactory: 'false' }).orderFactory).toBe(false)
    expect(toSearchFilters({ ...base, orderFactory: '' }).orderFactory).toBeNull()
    expect(toSearchFilters({ ...base, negocioFechado: 'true' }).negocioFechado).toBe(true)
  })

  it('trims text filters and treats whitespace-only as null', () => {
    expect(toSearchFilters({ ...base, clientName: '  Alpha  ' }).clientName).toBe('Alpha')
    expect(toSearchFilters({ ...base, clientName: '   ' }).clientName).toBeNull()
    expect(toSearchFilters({ ...base, idTpOrder: 'FAB' }).idTpOrder).toBe('FAB')
  })
})