/**
 * Unit tests for revenue recognition capacity rules (AGENT.md §14).
 */
import { describe, expect, it } from 'vitest'
import {
  canRecognize,
  recognitionCapacity,
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