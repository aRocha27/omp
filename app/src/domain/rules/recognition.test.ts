/**
 * Unit tests for revenue recognition capacity rules (AGENT.md §14).
 */
import { describe, expect, it } from 'vitest'
import {
  canRecognize,
  isWarrantyRecognition,
  recognitionCapacity,
  recognitionTotals,
  reconhecimentoEstado,
  WARRANTY_RECOGNITION_TYPES,
  WARRANTY_RECOGNITION_TYPE,
} from '@/domain/rules/recognition'

describe('recognitionCapacity', () => {
  describe('non-warranty side (ID_Tp_Reconhecimento <> "W")', () => {
    it('capacity = Sell_Price - Warranty_Reserve', () => {
      // AGENT.md §14 "Non-warranty maximum": Sell_Price - Warranty_Reserve
      expect(
        recognitionCapacity({
          Sell_Price: 10_000,
          Warranty_Reserve: 2_000,
          ID_Tp_Reconhecimento: 'INSTRUMENT',
        }),
      ).toBe(8_000)
    })

    it('treats any non-"W" code as the non-warranty side', () => {
      expect(
        recognitionCapacity({
          Sell_Price: 1_000,
          Warranty_Reserve: 100,
          ID_Tp_Reconhecimento: 'SERVICE',
        }),
      ).toBe(900)
    })

    it('uses the full Sell Price and blocks warranty when Tipo.Warranty is false', () => {
      const nonWarrantyOrder = {
        Sell_Price: 10_000,
        Warranty_Reserve: 2_000,
        Tipo_Warranty: false,
      }
      expect(recognitionCapacity({
        ...nonWarrantyOrder,
        ID_Tp_Reconhecimento: 'CM',
      })).toBe(10_000)
      expect(recognitionCapacity({
        ...nonWarrantyOrder,
        ID_Tp_Reconhecimento: 'WP',
      })).toBe(0)
    })

    it('returns null when Sell_Price is missing (cannot compute non-warranty max)', () => {
      expect(
        recognitionCapacity({
          Sell_Price: null,
          Warranty_Reserve: 2_000,
          ID_Tp_Reconhecimento: 'INSTRUMENT',
        }),
      ).toBeNull()
    })
  })

  describe('warranty side (ID_Tp_Reconhecimento === "W")', () => {
    it('capacity = Warranty_Reserve', () => {
      // AGENT.md §14 "Warranty maximum": Warranty_Reserve
      expect(
        recognitionCapacity({
          Sell_Price: 10_000,
          Warranty_Reserve: 2_000,
          ID_Tp_Reconhecimento: WARRANTY_RECOGNITION_TYPE,
        }),
      ).toBe(2_000)
    })

    it('ignores Sell_Price for the warranty side', () => {
      expect(
        recognitionCapacity({
          Sell_Price: null,
          Warranty_Reserve: 2_500,
          ID_Tp_Reconhecimento: 'W',
        }),
      ).toBe(2_500)
    })

    it('returns null when Warranty_Reserve is missing', () => {
      expect(
        recognitionCapacity({
          Sell_Price: 10_000,
          Warranty_Reserve: null,
          ID_Tp_Reconhecimento: 'W',
        }),
      ).toBeNull()
    })
  })

  describe('null / missing inputs', () => {
    it('returns null when ID_Tp_Reconhecimento is null (side unknown)', () => {
      expect(
        recognitionCapacity({
          Sell_Price: 10_000,
          Warranty_Reserve: 2_000,
          ID_Tp_Reconhecimento: null,
        }),
      ).toBeNull()
    })

    it('returns null when both price and reserve are null', () => {
      expect(
        recognitionCapacity({
          Sell_Price: null,
          Warranty_Reserve: null,
          ID_Tp_Reconhecimento: 'INSTRUMENT',
        }),
      ).toBeNull()
    })
  })
})

describe('canRecognize', () => {
  const nonWarrantyOrder = {
    Sell_Price: 10_000,
    Warranty_Reserve: 2_000,
    ID_Tp_Reconhecimento: 'INSTRUMENT',
  }
  const warrantyOrder = {
    Sell_Price: 10_000,
    Warranty_Reserve: 2_000,
    ID_Tp_Reconhecimento: 'W' as const,
  }

  it('allows recognizing exactly the remaining capacity', () => {
    // capacity 8_000, nothing recognized yet, amount 8_000 → ok, remaining 0
    const result = canRecognize(nonWarrantyOrder, 0, 8_000)
    expect(result.ok).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('allows recognizing within remaining headroom', () => {
    const result = canRecognize(nonWarrantyOrder, 3_000, 5_000)
    expect(result.ok).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('rejects one cent over the capacity', () => {
    const result = canRecognize(nonWarrantyOrder, 0, 8_000.01)
    expect(result.ok).toBe(false)
    expect(result.remaining).toBeCloseTo(-0.01, 2)
  })

  it('rejects when already-recognized + amount exceeds capacity', () => {
    // capacity 8_000, 7_999 already recognized, 2 more → overshoots by 1
    const result = canRecognize(nonWarrantyOrder, 7_999, 2)
    expect(result.ok).toBe(false)
    expect(result.remaining).toBe(-1)
  })

  it('rejects when amount alone exceeds capacity', () => {
    const result = canRecognize(warrantyOrder, 0, 2_000.01)
    expect(result.ok).toBe(false)
    expect(result.remaining).toBeCloseTo(-0.01, 2)
  })

  it('rejects (remaining null) when capacity cannot be computed', () => {
    const result = canRecognize(
      { Sell_Price: null, Warranty_Reserve: 2_000, ID_Tp_Reconhecimento: 'INSTRUMENT' },
      0,
      100,
    )
    expect(result.ok).toBe(false)
    expect(result.remaining).toBeNull()
  })

  it('rejects (remaining null) when ID_Tp_Reconhecimento is null', () => {
    const result = canRecognize(
      { Sell_Price: 10_000, Warranty_Reserve: 2_000, ID_Tp_Reconhecimento: null },
      0,
      100,
    )
    expect(result.ok).toBe(false)
    expect(result.remaining).toBeNull()
  })

  it('respects the warranty side capacity (Warranty_Reserve, not Sell_Price - reserve)', () => {
    // warranty capacity = 2_000 regardless of Sell_Price
    expect(canRecognize(warrantyOrder, 0, 2_000).ok).toBe(true)
    expect(canRecognize(warrantyOrder, 0, 2_001).ok).toBe(false)
  })
})

describe('isWarrantyRecognition', () => {
  it('treats "W" and "WP" as the warranty side', () => {
    expect(isWarrantyRecognition('W')).toBe(true)
    expect(isWarrantyRecognition('WP')).toBe(true)
  })

  it('treats CM/P/T and null as the instrument side', () => {
    expect(isWarrantyRecognition('CM')).toBe(false)
    expect(isWarrantyRecognition('P')).toBe(false)
    expect(isWarrantyRecognition('T')).toBe(false)
    expect(isWarrantyRecognition(null)).toBe(false)
    expect(isWarrantyRecognition(undefined)).toBe(false)
  })

  it('WARRANTY_RECOGNITION_TYPES is W and WP', () => {
    expect([...WARRANTY_RECOGNITION_TYPES]).toEqual(['W', 'WP'])
  })

  it('WP draws from the warranty bucket, not the instrument bucket', () => {
    // capacity for WP must equal Warranty_Reserve (2_000), NOT Sell_Price - reserve (8_000)
    expect(
      recognitionCapacity({
        Sell_Price: 10_000,
        Warranty_Reserve: 2_000,
        ID_Tp_Reconhecimento: 'WP',
      }),
    ).toBe(2_000)
  })
})

describe('recognitionTotals', () => {
  // Order 1001 fixture: Sell_Price 48_500, Warranty_Reserve 1_455.
  const order = { Sell_Price: 48_500, Warranty_Reserve: 1_455 }
  type Reco = { ID_Tp_Reconhecimento: string | null; Valor_Reconhecimento: number | null }

  it('splits rows into instrument and warranty buckets', () => {
    const recos: Reco[] = [
      { ID_Tp_Reconhecimento: 'T', Valor_Reconhecimento: 35_000 },
      { ID_Tp_Reconhecimento: 'WP', Valor_Reconhecimento: 500 },
    ]
    const totals = recognitionTotals(order, recos)
    expect(totals.instrumentReconhecido).toBe(35_000)
    expect(totals.warrantyReconhecido).toBe(500)
    expect(totals.totalReconhecido).toBe(35_500)
  })

  it('Instrumento por Reconhecer = (Sell_Price − Warranty_Reserve) − instrumentReconhecido', () => {
    // The corrected formula (req 9): 48_500 − 1_455 − 35_000 = 12_045.
    // The old UI omitted the − Warranty_Reserve term and returned 13_500.
    const recos: Reco[] = [
      { ID_Tp_Reconhecimento: 'T', Valor_Reconhecimento: 35_000 },
    ]
    const totals = recognitionTotals(order, recos)
    expect(totals.instrumentPorReconhecer).toBe(12_045)
  })

  it('Garantia por Reconhecer = Warranty_Reserve − warrantyReconhecido', () => {
    const recos: Reco[] = [{ ID_Tp_Reconhecimento: 'WP', Valor_Reconhecimento: 455 }]
    const totals = recognitionTotals(order, recos)
    expect(totals.warrantyPorReconhecer).toBe(1_000)
  })

  it('clamps por-reconhecer at 0 when recognized exceeds capacity', () => {
    const recos: Reco[] = [{ ID_Tp_Reconhecimento: 'T', Valor_Reconhecimento: 60_000 }]
    const totals = recognitionTotals(order, recos)
    expect(totals.instrumentPorReconhecer).toBe(0)
  })

  it('treats W and WP together as the warranty bucket', () => {
    const recos: Reco[] = [
      { ID_Tp_Reconhecimento: 'W', Valor_Reconhecimento: 300 },
      { ID_Tp_Reconhecimento: 'WP', Valor_Reconhecimento: 455 },
    ]
    const totals = recognitionTotals(order, recos)
    expect(totals.warrantyReconhecido).toBe(755)
    expect(totals.warrantyPorReconhecer).toBe(700)
  })

  it('treats null/undefined Valor_Reconhecimento as 0', () => {
    const recos: Reco[] = [
      { ID_Tp_Reconhecimento: 'T', Valor_Reconhecimento: null },
      { ID_Tp_Reconhecimento: 'WP', Valor_Reconhecimento: undefined as unknown as null },
    ]
    const totals = recognitionTotals(order, recos)
    expect(totals.totalReconhecido).toBe(0)
  })

  it('handles empty recognition list', () => {
    const totals = recognitionTotals(order, [])
    expect(totals.instrumentReconhecido).toBe(0)
    expect(totals.instrumentPorReconhecer).toBe(47_045) // 48_500 − 1_455
    expect(totals.warrantyReconhecido).toBe(0)
    expect(totals.warrantyPorReconhecer).toBe(1_455)
    expect(totals.totalReconhecido).toBe(0)
  })

  it('ignores a stale reserve when the order type has no warranty', () => {
    const nonWarrantyOrder = {
      Sell_Price: 12_000,
      Warranty_Reserve: 2_000,
      Tipo_Warranty: false,
    }
    const totals = recognitionTotals(nonWarrantyOrder, [
      { ID_Tp_Reconhecimento: 'CM', Valor_Reconhecimento: 12_000 },
    ])

    expect(totals.instrumentReconhecido).toBe(12_000)
    expect(totals.instrumentPorReconhecer).toBe(0)
    expect(totals.warrantyPorReconhecer).toBe(0)
  })

  it('degrades to 0 capacity when Sell_Price/Warranty_Reserve are null', () => {
    const totals = recognitionTotals({ Sell_Price: null, Warranty_Reserve: null }, [])
    expect(totals.instrumentPorReconhecer).toBe(0)
    expect(totals.warrantyPorReconhecer).toBe(0)
  })
})

describe('reconhecimentoEstado', () => {
  it('returns "reconhecido" for a past date', () => {
    expect(reconhecimentoEstado({ DT_Reconhecimento: '2025-01-01' }, new Date('2025-08-25'))).toBe(
      'reconhecido',
    )
  })

  it('returns "reconhecido" for today (UTC day compare)', () => {
    expect(reconhecimentoEstado({ DT_Reconhecimento: '2025-08-25' }, new Date('2025-08-25'))).toBe(
      'reconhecido',
    )
  })

  it('returns "por-reconhecer" for a future date', () => {
    expect(reconhecimentoEstado({ DT_Reconhecimento: '2025-12-31' }, new Date('2025-08-25'))).toBe(
      'por-reconhecer',
    )
  })

  it('returns "por-reconhecer" when the date is null', () => {
    expect(reconhecimentoEstado({ DT_Reconhecimento: null }, new Date('2025-08-25'))).toBe(
      'por-reconhecer',
    )
  })

  it('returns "por-reconhecer" for an unparseable date', () => {
    expect(reconhecimentoEstado({ DT_Reconhecimento: 'not-a-date' }, new Date('2025-08-25'))).toBe(
      'por-reconhecer',
    )
  })
})