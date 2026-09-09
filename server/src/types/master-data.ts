export type MasterDataValue = string | number | boolean | null

export type MasterDataResult = {
  columns: string[]
  rows: Record<string, unknown>[]
  totalRows?: number
}
