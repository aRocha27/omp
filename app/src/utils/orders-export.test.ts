import { describe, expect, it } from 'vitest'
import {
  EXPORT_COLUMNS,
  buildOrdersFileName,
  buildOrdersWorksheet,
  type ExportFilterLabels,
} from '@/utils/orders-export'
import type { OrderSummary } from '@/domain/models/order'

const noFilters: ExportFilterLabels = {
  clientName: null,
  orderType: null,
  area: null,
  tipo: null,
  product: null,
  instrument: null,
  sapOrder: null,
  dateFrom: null,
  dateTo: null,
  factoryOnly: false,
  closedOnly: false,
}

const FIXED_DATE = new Date(2026, 7, 26) // 2026-08-26 → file name: 26-08-2026

const order: OrderSummary = {
  ID_Order: 1001,
  DT_Order: '2025-09-12',
  Order_Factory: false,
  ID_Tp_Order: 'C',
  Provisoria: false,
  ID_Client: 501,
  Client_Name: 'Client Alpha',
  ID_Area: 'BDAL',
  ID_Tipo: 'INSTR',
  ID_Produto: 10,
  ID_Instrumento: 1,
  Sell_Price: 48500,
  Negocio_Fechado: true,
  Encomenda_Cli_PHC: 'PHC-1001',
  Kit: false,
  ID_Tp_Warranty: 1,
  Warranty_Reserve: 1455,
  Warranty_DT_Inicio: '2025-09-13',
  Orc_Proposta: 'ORC-1001',
  PO_Cliente: 'PO-ALPHA-001',
  ID_Tp_Revenue: 1,
}

/** Convert a 0-based column index to its A1 letter (0 → A, 1 → B, … 18 → S). */
function columnLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

describe('buildOrdersFileName', () => {
  it('uses just the date when no filter is active', () => {
    expect(buildOrdersFileName(noFilters, FIXED_DATE)).toBe('order-26-08-2026.xlsx')
  })

  it('emits a slug per active filter in the bar order, joined with dashes', () => {
    expect(
      buildOrdersFileName(
        {
          ...noFilters,
          clientName: 'Client Alpha',
          area: 'BDAL',
          product: 'Maldi-TOF',
          factoryOnly: true,
        },
        FIXED_DATE,
      ),
    ).toBe('order-client-alpha-bdal-maldi-tof-factory-26-08-2026.xlsx')
  })

  it('transliterates accents and special characters in user input', () => {
    expect(
      buildOrdersFileName({ ...noFilters, clientName: 'Ação & Cia' }, FIXED_DATE),
    ).toBe('order-acao-cia-26-08-2026.xlsx')
  })

  it('omits a filter whose value is empty / null', () => {
    expect(
      buildOrdersFileName(
        { ...noFilters, clientName: '', area: null, factoryOnly: true },
        FIXED_DATE,
      ),
    ).toBe('order-factory-26-08-2026.xlsx')
  })

  it('strips non-numeric date components so the file name sorts chronologically', () => {
    // Day-month-year (dd-mm-yyyy) is the user's chosen convention; this test
    // pins it so a future refactor doesn't drift to ISO.
    expect(buildOrdersFileName(noFilters, FIXED_DATE)).toContain('26-08-2026')
  })
})

describe('buildOrdersWorksheet', () => {
  it('writes one column per EXPORT_COLUMNS entry, with the visible header label', () => {
    const sheet = buildOrdersWorksheet([order])
    // SheetJS uses an "A1" range (or an empty string for an empty sheet) — we
    // only assert the header row is populated.
    expect(Object.keys(sheet)).toContain('!ref')
    // Each header cell is at the column letter matching its index (A, B, C, …).
    // We assert the A1 range covers a header row + a data row, so the test
    // stays resilient to SheetJS' internal layout.
    const a1 = String(sheet['!ref'])
    expect(a1).toMatch(/^A1:[A-Z]+\d+$/)
    expect(a1).toBe(`A1:${columnLetter(EXPORT_COLUMNS.length - 1)}2`)
  })

  it('resolves IDs to their human-readable labels in the cell value', () => {
    const sheet = buildOrdersWorksheet([order])
    // Column letters in A1 notation — A=ID, B=Order type, C=SAP Order,
    // D=Date, E=Client, F=Area, G=Type, H=Product, I=Instrument, J=Sell price,
    // K=Deal closed, L=Fatory, … — matches the EXPORT_COLUMNS order.
    expect(sheet['B2']?.v).toBe('Client') // ID_Tp_Order "C" → "Client"
    expect(sheet['F2']?.v).toBe('BDAL') // ID_Area "BDAL" → "BDAL"
    expect(sheet['G2']?.v).toBe('INSTRUMENT') // ID_Tipo "INSTR" → "INSTRUMENT"
    expect(sheet['H2']?.v).toBe('Maldi-TOF') // ID_Produto 10 → "Maldi-TOF"
    // Sell_Price stays a raw number so Excel can sum it.
    expect(sheet['J2']?.v).toBe(48500)
    // Dates are pre-formatted as dd/mm/yyyy.
    expect(sheet['D2']?.v).toBe('12/09/2025')
    // Booleans become Yes / No.
    expect(sheet['K2']?.v).toBe('Yes') // Negocio_Fechado
    expect(sheet['L2']?.v).toBe('No') // Order_Factory
  })

  it('produces an empty sheet when there are no orders (only the header row)', () => {
    const sheet = buildOrdersWorksheet([])
    // No data rows → the A1 range covers only the header row (row 1).
    expect(String(sheet['!ref'])).toBe('A1:S1')
  })
})
