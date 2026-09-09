import reportCss from './production-report.css?raw'

const logoUrl = '/paperfold-logo.svg'

export interface CrosstabPrintReportOptions {
  rows: (string | number)[][]
  measureCount: number
  filters: { startDate: string; endDate: string; area: string[]; grpReport: string[]; produto: string[] }
}

type Totals = number[]
type ReportRow = { dimensions: string[]; values: number[] }
type ReportModel = { title: string; filters: string; dimensions: string[]; measures: string[]; rows: ReportRow[] }

export function openCrosstabPrintReport({ rows, measureCount, filters }: CrosstabPrintReportOptions): void {
  const reportWindow = window.open('', '_blank')
  if (!reportWindow) return

  const [headers = [], ...rawRows] = rows
  const numericStart = Math.max(0, headers.length - measureCount)
  const model: ReportModel = {
    title: reportTitle(headers.slice(0, numericStart).map(String)),
    filters: [
      filters.startDate && `Start date: ${filters.startDate}`,
      filters.endDate && `End date: ${filters.endDate}`,
      filters.area.length > 0 && `Area: ${filters.area.join(', ')}`,
      filters.grpReport.length > 0 && `Group: ${filters.grpReport.join(', ')}`,
    ].filter(Boolean).join('  |  ') || 'Sem filtros adicionais',
    dimensions: headers.slice(0, numericStart).map(String),
    measures: headers.slice(numericStart).map(String),
    rows: rawRows.map((row) => ({
      dimensions: row.slice(0, numericStart).map((value) => String(value ?? '—')),
      values: row.slice(numericStart).map((value) => Number(value ?? 0)),
    })),
  }

  reportWindow.document.open()
  reportWindow.document.write(renderReport(model))
  reportWindow.document.close()
}

function renderReport(model: ReportModel): string {
  const areaIndex = findDimension(model.dimensions, 'area')
  const groupIndex = findDimension(model.dimensions, 'group')
  const visibleDimensions = preferredDimensions(model.dimensions, areaIndex)
  const sections = groupBy(model.rows, areaIndex)
  const tableSections = sections.map(([area, areaRows]) => renderArea(area, areaRows, model, visibleDimensions, groupIndex)).join('')
  const grandTotals = model.rows.reduce((totals, row) => addTotals(totals, row.values), zeroTotals(model.measures.length))
  const table = model.rows.length > 0
    ? `${tableSections}<table class="report-table grand-table"><tbody><tr class="grand-total"><td colspan="${Math.max(1, visibleDimensions.length)}">TOTAL GERAL</td>${numberCells(grandTotals)}</tr></tbody></table>`
    : '<div class="no-data">No data is available for the selected filters.</div>'
  const kpis = model.measures.map((measure, index) => `<div class="kpi"><span>${escapeHtml(displayDimension(measure))}</span><strong>${formatMoney(grandTotals[index] ?? 0)}</strong></div>`).join('')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(model.title)}</title><style>${reportCss}</style></head><body><main class="report-page"><div class="report-shell"><header class="report-header"><div><p class="report-eyebrow">Paperfold Reporting · Production Report</p><h1 class="report-title">${escapeHtml(model.title)}</h1><p class="report-subtitle">Operational report by area, group, type and product.</p></div><div class="brand-block"><img src="${escapeHtml(logoUrl)}" alt="Paperfold Stationery"><div class="brand-copy"><strong>Paperfold Stationery</strong><span>Paperfold · Reporting</span></div></div></header><section class="report-meta"><div class="meta-card"><span class="meta-label">Filters</span><span class="meta-value">${escapeHtml(model.filters)}</span></div><div class="meta-card"><span class="meta-label">Scope</span><span class="meta-value">${escapeHtml(model.dimensions.map(displayDimension).join(' · ') || 'None')}</span></div></section><section class="kpi-strip">${kpis}</section><section class="report-content">${table}</section></div><footer class="report-footer"><span>${new Date().toLocaleDateString('en-GB')}</span><span class="confidential">PAPERFOLD CONFIDENTIAL</span><span class="page-number"></span></footer></main><script>window.onload=function(){window.focus();window.print()}</script></body></html>`
}

function renderArea(area: string, rows: ReportRow[], model: ReportModel, dimensions: number[], groupIndex: number): string {
  const rowsByGroup = groupBy(rows, groupIndex)
  const typeIndex = findDimension(model.dimensions, 'type')
  const body = rowsByGroup.map(([group, groupRows]) => {
    const detail = [...groupRows].sort((left, right) => compareTypeRows(left, right, typeIndex)).map((row) => detailRow(row, dimensions)).join('')
    return `${detail}${subtotalRow(`Total - Group: ${group}`, groupRows, dimensions.length, 'group-total')}`
  }).join('')
  const areaTotal = subtotalRow(`Total - Area: ${area}`, rows, dimensions.length, 'area-total')
  return `<section class="area-block"><div class="area-heading"><h2>Area · ${escapeHtml(area)}</h2><span>${rows.length} records</span></div><table class="report-table"><thead><tr>${dimensions.map((index) => `<th>${escapeHtml(displayDimension(model.dimensions[index]))}</th>`).join('')}${model.measures.map((measure) => `<th class="num">${escapeHtml(displayDimension(measure))}</th>`).join('')}</tr></thead><tbody>${body}${areaTotal}</tbody></table></section>`
}

function detailRow(row: ReportRow, dimensions: number[]): string {
  return `<tr class="detail">${dimensions.map((index) => `<td>${escapeHtml(row.dimensions[index] ?? '—')}</td>`).join('')}${numberCells(row.values)}</tr>`
}

function subtotalRow(label: string, rows: ReportRow[], dimensionCount: number, className: string): string {
  const totals = rows.reduce((result, row) => addTotals(result, row.values), zeroTotals(rows[0]?.values.length ?? 0))
  return `<tr class="${className}"><td colspan="${Math.max(1, dimensionCount)}">${escapeHtml(label)}</td>${numberCells(totals)}</tr>`
}

function preferredDimensions(dimensions: string[], areaIndex: number): number[] {
  const preferred: DimensionKind[] = ['group', 'type', 'product']
  const ordered = preferred.map((kind) => findDimension(dimensions, kind)).filter((index) => index >= 0)
  return [...ordered, ...dimensions.map((_, index) => index).filter((index) => index !== areaIndex && !ordered.includes(index))]
}

function reportTitle(dimensions: string[]): string {
  if (findDimension(dimensions, 'product') >= 0) return 'By Area-Type-Product YTD'
  if (findDimension(dimensions, 'type') >= 0) return 'By Area-Type YTD'
  return 'By Area YTD'
}

function displayDimension(value: string): string {
  const kind = normalize(value)
  if (kind === 'area' || kind === 'id_area') return 'Area'
  if (kind === 'grp_report' || kind === 'group' || kind === 'id_grp_report') return 'Group'
  if (kind === 'tipo' || kind === 'type' || kind === 'id_tipo') return 'Type'
  if (kind === 'produto' || kind === 'product' || kind === 'id_produto') return 'Product'
  if (kind === 'backlog_start') return 'Backlog Start'
  if (kind === 'backlog_end') return 'Backlog End'
  return value
}

function compareTypeRows(left: ReportRow, right: ReportRow, typeIndex: number): number {
  if (typeIndex < 0) return 0
  const order = ['instrument', 'acessories', 'accessories', 'consumables']
  const leftType = normalize(left.dimensions[typeIndex] ?? '')
  const rightType = normalize(right.dimensions[typeIndex] ?? '')
  const leftRank = order.indexOf(leftType)
  const rightRank = order.indexOf(rightType)
  if (leftRank >= 0 || rightRank >= 0) return (leftRank < 0 ? order.length : leftRank) - (rightRank < 0 ? order.length : rightRank)
  return leftType.localeCompare(rightType)
}

type DimensionKind = 'area' | 'group' | 'type' | 'product'
function findDimension(dimensions: string[], kind: DimensionKind): number {
  const aliases: Record<typeof kind, string[]> = {
    area: ['area', 'id_area'], group: ['grp_report', 'group', 'id_grp_report'], type: ['tipo', 'type', 'id_tipo'], product: ['produto', 'product', 'id_produto'],
  }
  return dimensions.findIndex((dimension) => aliases[kind].includes(normalize(dimension)))
}

function groupBy(rows: ReportRow[], index: number): [string, ReportRow[]][] {
  if (index < 0) return [['', rows]]
  const groups = new Map<string, ReportRow[]>()
  for (const row of rows) groups.set(row.dimensions[index] ?? '—', [...(groups.get(row.dimensions[index] ?? '—') ?? []), row])
  return [...groups.entries()]
}

function normalize(value: string): string { return value.toLowerCase().replace(/[áàãâ]/g, 'a').replace(/[éê]/g, 'e').replace(/[í]/g, 'i').replace(/[óôõ]/g, 'o').replace(/[ú]/g, 'u').replace(/[^a-z0-9_]/g, '') }
function zeroTotals(length: number): Totals { return Array.from({ length }, () => 0) }
function addTotals(target: Totals, source: Totals): Totals { source.forEach((value, index) => { target[index] = (target[index] ?? 0) + value }); return target }
function numberCells(values: Totals): string { return values.map((value) => `<td class="num">${formatMoney(value)}</td>`).join('') }
function escapeHtml(value: string): string { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character) }
function formatMoney(value: number): string { return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value) }
