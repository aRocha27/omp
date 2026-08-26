/**
 * Mock Recognition report repository.
 *
 * `api` mode (HTTP repository) reads from `dbo.V_Reconhecimento_Monthly_Crosstab`
 * via `POST /api/recognition/list` + `GET /api/recognition/filter-options`.
 * Mock mode returns a deterministic, fixture-driven dataset so the page works
 * in dev / CI without a live database. The shape exactly mirrors the live
 * `RecognitionReportRow` — the UI is unaware of mock vs HTTP.
 *
 * The dataset is generated procedurally from a small seed set so the
 * filters have a meaningful universe to narrow against: three areas,
 * three report groups, three tipos, two products, and three clients.
 * Months get a non-zero split for some years so the totals reflect the
 * monthly crosstab (not a single year-end lump). Recognitions dated to
 * 2099 land in a separate "future" year — `Year_Recognition = null` in
 * the live view for those rows because the year couldn't be derived.
 */
import type {
  RecognitionReportFilters,
  RecognitionReportOptions,
  RecognitionReportRow,
} from '@/domain/models/recognition-report'
import type { RecognitionReportRepository } from '@/services/contracts/recognition-report.repository'

const MOCK_LATENCY_MS = 80

interface SeedRow {
  area: string
  grpReport: string
  tipo: string
  produto: string
  encomendaCliPHC: string
  cliente: string
  sellPrice: number
  tpReconhecimento: string
  /** Year the recognitions were posted (null → Year_Recognition is null). */
  year: number | null
  /** 12 monthly values (Jan..Dec). Index 0 = Jan, index 11 = Dec. */
  months: readonly number[]
}

const SEED: readonly SeedRow[] = [
  {
    area: 'BOPT',
    grpReport: 'Service',
    tipo: 'SERVICE',
    produto: 'NIR',
    encomendaCliPHC: 'PHC-1001',
    cliente: 'ITQB',
    sellPrice: 48000,
    tpReconhecimento: 'Parcial',
    year: 2024,
    months: [0, 0, 4800, 4800, 4800, 4800, 4800, 4800, 4800, 4800, 4800, 4800],
  },
  {
    area: 'BOPT',
    grpReport: 'Service',
    tipo: 'SERVICE',
    produto: 'NIR',
    encomendaCliPHC: 'PHC-1002',
    cliente: 'ITQB',
    sellPrice: 12500,
    tpReconhecimento: 'Total',
    year: 2024,
    months: [0, 0, 0, 0, 0, 0, 0, 12500, 0, 0, 0, 0],
  },
  {
    area: 'BDAL',
    grpReport: 'Product',
    tipo: 'INSTRUMENT',
    produto: 'Maldi-TOF',
    encomendaCliPHC: 'PHC-2001',
    cliente: 'Universidade de Évora',
    sellPrice: 750000,
    tpReconhecimento: 'Parcial',
    year: 2025,
    months: [0, 0, 0, 0, 150000, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    area: 'BDAL',
    grpReport: 'Product',
    tipo: 'CONSUMABLES',
    produto: 'GC-MS',
    encomendaCliPHC: 'PHC-2002',
    cliente: 'LNEG',
    sellPrice: 12500,
    tpReconhecimento: 'Total',
    year: 2025,
    months: [0, 0, 0, 0, 0, 12500, 0, 0, 0, 0, 0, 0],
  },
  {
    area: 'BOPT',
    grpReport: 'Product',
    tipo: 'INSTRUMENT',
    produto: 'Maldi-TOF',
    encomendaCliPHC: 'PHC-2003',
    cliente: 'Universidade de Évora',
    sellPrice: 90000,
    tpReconhecimento: 'Parcial',
    year: 2025,
    months: [0, 0, 0, 0, 0, 0, 0, 0, 0, 30000, 30000, 30000],
  },
  {
    area: 'BDAL',
    grpReport: 'Service',
    tipo: 'CM',
    produto: 'NIR',
    encomendaCliPHC: 'PHC-3001',
    cliente: 'LNEG',
    sellPrice: 36000,
    tpReconhecimento: 'Parcial',
    year: 2026,
    months: [3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000],
  },
  {
    // Simulates a future-dated recognition whose year can't be derived:
    // the live view exposes `Year_Recognition = null` for these rows.
    area: 'BOPT',
    grpReport: 'Service',
    tipo: 'SERVICE',
    produto: 'GC-MS',
    encomendaCliPHC: 'PHC-3002',
    cliente: 'Hospital de Santa Maria',
    sellPrice: 0,
    tpReconhecimento: 'Parcial',
    year: null,
    months: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
]

function seedToRow(seed: SeedRow): RecognitionReportRow {
  const total = seed.months.reduce((sum, value) => sum + value, 0)
  return {
    yearRecognition: seed.year,
    area: seed.area,
    grpReport: seed.grpReport,
    tipo: seed.tipo,
    produto: seed.produto,
    encomendaCliPHC: seed.encomendaCliPHC,
    cliente: seed.cliente,
    sellPrice: seed.sellPrice,
    tpReconhecimento: seed.tpReconhecimento,
    january: seed.months[0] ?? 0,
    february: seed.months[1] ?? 0,
    march: seed.months[2] ?? 0,
    april: seed.months[3] ?? 0,
    may: seed.months[4] ?? 0,
    june: seed.months[5] ?? 0,
    july: seed.months[6] ?? 0,
    august: seed.months[7] ?? 0,
    september: seed.months[8] ?? 0,
    october: seed.months[9] ?? 0,
    november: seed.months[10] ?? 0,
    december: seed.months[11] ?? 0,
    totalYear: total,
  }
}

function matchesAny(value: string | number | null, allowed: readonly (string | number)[]): boolean {
  if (allowed.length === 0) return true
  if (value === null || value === undefined) return false
  return allowed.some((candidate) => candidate === value)
}

function applyFilters(
  rows: readonly RecognitionReportRow[],
  filters: RecognitionReportFilters,
): RecognitionReportRow[] {
  return rows.filter(
    (row) =>
      matchesAny(row.yearRecognition, filters.yearRecognition) &&
      matchesAny(row.area, filters.area) &&
      matchesAny(row.grpReport, filters.grpReport) &&
      matchesAny(row.tipo, filters.tipo) &&
      matchesAny(row.produto, filters.produto) &&
      matchesAny(row.encomendaCliPHC, filters.encomendaCliPHC),
  )
}

const UNIVERSE: readonly RecognitionReportRow[] = SEED.map(seedToRow)

const OPTIONS: RecognitionReportOptions = (() => {
  const years = new Set<number>()
  const areas = new Set<string>()
  const grpReports = new Set<string>()
  const tipos = new Set<string>()
  const produtos = new Set<string>()
  const encomendas = new Set<string>()
  for (const row of UNIVERSE) {
    if (row.yearRecognition != null) years.add(row.yearRecognition)
    if (row.area) areas.add(row.area)
    if (row.grpReport) grpReports.add(row.grpReport)
    if (row.tipo) tipos.add(row.tipo)
    if (row.produto) produtos.add(row.produto)
    if (row.encomendaCliPHC) encomendas.add(row.encomendaCliPHC)
  }
  return {
    years: Array.from(years).sort((a, b) => b - a),
    areas: Array.from(areas).sort(),
    grpReports: Array.from(grpReports).sort(),
    tipos: Array.from(tipos).sort(),
    produtos: Array.from(produtos).sort(),
    encomendas: Array.from(encomendas).sort(),
  }
})()

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class MockRecognitionReportRepository implements RecognitionReportRepository {
  async list(
    filters: RecognitionReportFilters,
    limit: number,
  ): Promise<RecognitionReportRow[]> {
    await delay(MOCK_LATENCY_MS)
    const rows = applyFilters(UNIVERSE, filters).slice(0, limit)
    return rows.map((row) => ({ ...row }))
  }

  async getFilterOptions(): Promise<RecognitionReportOptions> {
    await delay(MOCK_LATENCY_MS)
    return {
      years: [...OPTIONS.years],
      areas: [...OPTIONS.areas],
      grpReports: [...OPTIONS.grpReports],
      tipos: [...OPTIONS.tipos],
      produtos: [...OPTIONS.produtos],
      encomendas: [...OPTIONS.encomendas],
    }
  }
}
