/**
 * Cascade reference-data models for Área → Produto → Instrumento.
 *
 * These mirror the server rows (`server/src/types.ts` `AreaRow`/`ProdutoRow`/
 * `InstrumentoRow`) and back the dependent dropdowns in the create/detail forms.
 * `area` on `ProdutoOption` and `produto` on `InstrumentoOption` carry the parent
 * id so the frontend can drive the cascade client-side in mock mode and validate
 * the server-filtered lists in live mode.
 */

export interface AreaOption {
  id: string
  label: string
}

export interface ProdutoOption {
  id: number
  label: string
  area: string | null
}

export interface InstrumentoOption {
  id: number
  label: string
  produto: number | null
}