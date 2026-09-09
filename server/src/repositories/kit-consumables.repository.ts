import { createRequire } from 'node:module'
import type { ConnectionPool } from 'mssql'
import { toKitConsumableRow } from './row-mappers.js'
import type { KitConsumablePatch, KitConsumableRow, NewKitConsumableInput } from '../types.js'

const mssql = createRequire(import.meta.url)('mssql') as typeof import('mssql')
const ORDERS_SCHEMA = 'dbo'
const KIT_CONSUMABLES_TABLE = 'Kit_Consumables'
const UPDATEABLE_COLUMNS = [
  { column: 'Date' as const, type: mssql.DateTime },
  { column: 'Internal_Order' as const, type: mssql.NVarChar },
  { column: 'Material' as const, type: mssql.NVarChar },
  { column: 'Description' as const, type: mssql.NVarChar },
  { column: 'Quant' as const, type: mssql.Int },
  { column: 'Unit_Price' as const, type: mssql.Money },
  { column: 'Total_Price' as const, type: mssql.Money },
]

export async function fetchKitConsumables(
  pool: ConnectionPool,
  orderId: number,
): Promise<KitConsumableRow[]> {
  const request = pool.request()
  request.input('orderId', mssql.Int, orderId)
  const result = await request.query<Record<string, unknown>>(`SELECT
    ID_Kit, ID_Order, Date, Internal_Order, Material, Description,
    Quant, Unit_Price, Total_Price
  FROM [${ORDERS_SCHEMA}].[${KIT_CONSUMABLES_TABLE}]
  WHERE ID_Order = @orderId
  ORDER BY ID_Kit ASC`)
  return Array.from(result.recordset).map(toKitConsumableRow)
}

export async function addKitConsumable(
  pool: ConnectionPool,
  input: NewKitConsumableInput,
): Promise<KitConsumableRow> {
  const request = pool.request()
  request.input('orderId', mssql.Int, input.ID_Order)
  request.input('date', mssql.DateTime, input.Date)
  request.input('internalOrder', mssql.NVarChar, input.Internal_Order)
  request.input('material', mssql.NVarChar, input.Material)
  request.input('description', mssql.NVarChar, input.Description)
  request.input('quant', mssql.Int, input.Quant)
  request.input('unitPrice', mssql.Money, input.Unit_Price)
  request.input('totalPrice', mssql.Money, input.Total_Price)
  const inserted = await request.query<
    Record<string, unknown>
  >(`INSERT INTO [${ORDERS_SCHEMA}].[${KIT_CONSUMABLES_TABLE}]
      (ID_Order, Date, Internal_Order, Material, Description, Quant, Unit_Price, Total_Price)
     OUTPUT INSERTED.ID_Kit, INSERTED.ID_Order, INSERTED.Date,
            INSERTED.Internal_Order, INSERTED.Material, INSERTED.Description,
            INSERTED.Quant, INSERTED.Unit_Price, INSERTED.Total_Price
     VALUES (@orderId, @date, @internalOrder, @material, @description, @quant, @unitPrice, @totalPrice)`)
  const row = inserted.recordset[0]
  if (!row) throw new Error('The database did not return the kit consumable row.')
  return toKitConsumableRow(row)
}

export async function updateKitConsumable(
  pool: ConnectionPool,
  id: number,
  patch: KitConsumablePatch,
): Promise<KitConsumableRow | null> {
  const request = pool.request()
  request.input('id', mssql.Int, id)
  const setClauses: string[] = []
  for (const { column, type } of UPDATEABLE_COLUMNS) {
    if (column in patch) {
      setClauses.push(`${column} = @${column}`)
      request.input(column, type, patch[column])
    }
  }
  if (setClauses.length === 0) {
    const current = await request.query<
      Record<string, unknown>
    >(`SELECT ID_Kit, ID_Order, Date, Internal_Order, Material, Description,
              Quant, Unit_Price, Total_Price
       FROM [${ORDERS_SCHEMA}].[${KIT_CONSUMABLES_TABLE}]
       WHERE ID_Kit = @id`)
    return current.recordset[0] ? toKitConsumableRow(current.recordset[0]) : null
  }
  const updated = await request.query<
    Record<string, unknown>
  >(`UPDATE [${ORDERS_SCHEMA}].[${KIT_CONSUMABLES_TABLE}]
     SET ${setClauses.join(', ')}
     OUTPUT INSERTED.ID_Kit, INSERTED.ID_Order, INSERTED.Date,
            INSERTED.Internal_Order, INSERTED.Material, INSERTED.Description,
            INSERTED.Quant, INSERTED.Unit_Price, INSERTED.Total_Price
     WHERE ID_Kit = @id`)
  const row = updated.recordset[0]
  return row ? toKitConsumableRow(row) : null
}

export async function deleteKitConsumable(pool: ConnectionPool, id: number): Promise<boolean> {
  const request = pool.request()
  request.input('id', mssql.Int, id)
  const result = await request.query(
    `DELETE FROM [${ORDERS_SCHEMA}].[${KIT_CONSUMABLES_TABLE}] WHERE ID_Kit = @id`,
  )
  return (result.rowsAffected[0] ?? 0) > 0
}
