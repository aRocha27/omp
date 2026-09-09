/**
 * Reference cascade wire types for Área → Produto → Instrumento
 * (dbo.Area/Produto/Instrumento).
 *
 * `area` on Produto and `produto` on Instrumento carry the parent id so
 * the frontend can drive dependent dropdowns without a second round-trip.
 * Verified against the demo schema.
 */

export type AreaRow = { id: string; label: string }
export type ProdutoRow = { id: number; label: string; area: string | null }
export type InstrumentoRow = { id: number; label: string; produto: number | null }

export type OkAreas = { ok: true; areas: AreaRow[] }
export type OkProdutos = { ok: true; produtos: ProdutoRow[] }
export type OkInstrumentos = { ok: true; instrumentos: InstrumentoRow[] }