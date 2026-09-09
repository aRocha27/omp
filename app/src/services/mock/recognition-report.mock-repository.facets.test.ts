/**
 * * Mock Recognition report repository — faceted filtering contract.
 *
 * The Recognition crosstab is the same shape as the Orders list (one
 * fact table joined to several dimensions). The mock applies the same
 * exclude-own-facet semantics as the backend: each dimension's DISTINCT
 * runs against the rows that survive every OTHER active filter, with the
 * dimension's own filter excluded. The seed fixture has a finite, known
 * set of dimension combinations so the tests can assert which options are
 * still valid under each filter scenario.
 */
import { describe, it, expect } from 'vitest'
import { MockRecognitionReportRepository } from '@/services/mock/recognition-report.mock-repository'
import { emptyRecognitionReportFilters } from '@/domain/models/recognition-report'

const repo = new MockRecognitionReportRepository()

describe('MockRecognitionReportRepository.facets — faceted filtering', () => {
  it('returns the full universe when no filters are active', async () => {
    const facets = await repo.facets({})
    // The seed fixture defines 3 areas, 3 grpReports, 3 tipos, 2 produtos,
    // 6 encomendas, 2 tpReconhecimentos, 2 years (2024, 2025) + 1 null year.
    expect(facets.area.map((entry) => entry.id).sort()).toEqual(['BDAL', 'BOPT'])
    expect(facets.tipo.map((entry) => entry.id).sort()).toEqual([
      'CM',
      'CONSUMABLES',
      'INSTRUMENT',
      'SERVICE',
    ])
    expect(facets.produto.map((entry) => entry.id).sort()).toEqual([
      'GC-MS',
      'Maldi-TOF',
      'NIR',
    ])
    expect(facets.tpReconhecimento.map((entry) => entry.id).sort()).toEqual([
      'Parcial',
      'Total',
    ])
    // Years come back as numbers — 2024, 2025, 2026 (PHC-3002's year is
    // null and is preserved by the mock as `{ id: null, label: null }`
    // so the UI can render a muted slot rather than the raw id).
    const yearIds = facets.yearRecognition.map((entry) => entry.id)
    expect(
      yearIds.filter((value): value is number => typeof value === 'number').sort(),
    ).toEqual([2024, 2025, 2026])
    const hasNullYear = facets.yearRecognition.some((entry) => entry.id === null)
    expect(hasNullYear).toBe(true)
  })

  it('restricts Areas to the ones that coexist with the active Tipo filter', async () => {
    // Filter to Tipo = INSTRUMENT — only BDAL + BOPT rows have INSTRUMENT in
    // the seed (1003 + 1005); both areas survive.
    const facets = await repo.facets({ tipo: ['INSTRUMENT'] })
    expect(facets.area.map((entry) => entry.id).sort()).toEqual(['BDAL', 'BOPT'])

    // Narrow further to Tipo = CM (only PHC-3001, BDAL) — only BDAL survives.
    const facetsCm = await repo.facets({ tipo: ['CM'] })
    expect(facetsCm.area.map((entry) => entry.id)).toEqual(['BDAL'])
  })

  it('restricts Tipos to the ones that coexist with the active Area filter', async () => {
    // Area = BOPT → the seed has BOPT rows with Tipos SERVICE
    // (PHC-1001/1002/3002) and INSTRUMENT (PHC-2003). CM is only on a BDAL
    // row (PHC-3001) so it's excluded by the BOPT filter.
    const facets = await repo.facets({ area: ['BOPT'] })
    expect(facets.tipo.map((entry) => entry.id).sort()).toEqual([
      'INSTRUMENT',
      'SERVICE',
    ])

    // Area = BDAL → BDAL Tipos survive (INSTRUMENT on PHC-2001/2005 +
    // CONSUMABLES on PHC-2002 + CM on PHC-3001).
    const facetsBdal = await repo.facets({ area: ['BDAL'] })
    expect(facetsBdal.tipo.map((entry) => entry.id).sort()).toEqual([
      'CM',
      'CONSUMABLES',
      'INSTRUMENT',
    ])
  })

  it('preserves the own filter as an option when it is the only one (exclude-own-facet)', async () => {
    // Filter Area = BDAL — the Area dropdown must still offer BDAL so the
    // user can keep or change the selection. The exclude-own-facet rule
    // drops the OWN filter from the WHERE clause when computing the
    // DISTINCT, so the option set lists every area that appears in the
    // seed rows: BDAL (the active selection) and BOPT (a value the user
    // could switch to). The user's selection is preserved by the
    // dropdown's `selected` set, not by the option list.
    const facets = await repo.facets({ area: ['BDAL'] })
    const ids = facets.area.map((entry) => entry.id).sort()
    expect(ids).toEqual(['BDAL', 'BOPT'])
  })

  it('drops null ids from string facets so the UI never renders meaningless "—" entries', async () => {
    // PHC-3002 has Year_Recognition = null. No filter narrows it out, so it
    // still shows in the yearRecognition facet as `{ id: null, label: null }`.
    // String facets like Area must never produce a `{ id: null, ... }` entry
    // because the underlying column is non-null — the mock filters those out.
    const facets = await repo.facets({})
    for (const dimension of [
      'area',
      'grpReport',
      'tipo',
      'produto',
      'encomendaCliPHC',
      'tpReconhecimento',
    ] as const) {
      const values = facets[dimension]
      for (const entry of values) {
        expect(entry.id === null).toBe(false)
      }
    }
  })

  it('narrows Produtos via the active Tipo filter', async () => {
    // Tipo = SERVICE → only NIR (PHC-1001/1002/3002) and GC-MS (PHC-3002)
    // survive. Maldi-TOF + CM tipo are out.
    const facets = await repo.facets({ tipo: ['SERVICE'] })
    expect(facets.produto.map((entry) => entry.id).sort()).toEqual(['GC-MS', 'NIR'])

    // Tipo = INSTRUMENT → only Maldi-TOF (PHC-2001/2003) survives.
    const facetsInstr = await repo.facets({ tipo: ['INSTRUMENT'] })
    expect(facetsInstr.produto.map((entry) => entry.id)).toEqual(['Maldi-TOF'])
  })

  it('narrows Encomenda_Cli_PHC via the active Year filter', async () => {
    // Year = 2024 → only PHC-1001 + PHC-1002 survive.
    const facets = await repo.facets({ yearRecognition: [2024] })
    expect(facets.encomendaCliPHC.map((entry) => entry.id).sort()).toEqual([
      'PHC-1001',
      'PHC-1002',
    ])

    // Year = 2025 → PHC-2001, PHC-2002, PHC-2003 survive.
    const facets2025 = await repo.facets({ yearRecognition: [2025] })
    expect(facets2025.encomendaCliPHC.map((entry) => entry.id).sort()).toEqual([
      'PHC-2001',
      'PHC-2002',
      'PHC-2003',
    ])
  })

  it('keeps the list query contract unchanged (still narrows rows by the active filters)', async () => {
    // The facets are independent of the row result; the list query must
    // still narrow rows by every active filter (no exclude-own semantics).
    const fullFilters = { ...emptyRecognitionReportFilters, tipo: ['INSTRUMENT'] }
    const rows = await repo.list(fullFilters, 100)
    for (const row of rows) {
      expect(row.tipo).toBe('INSTRUMENT')
    }
  })
})