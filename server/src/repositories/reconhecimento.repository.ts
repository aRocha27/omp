import { createRequire } from 'node:module'
import type { ConnectionPool } from 'mssql'
import { booleanOrNull, numberOrNull, stringOrNull, PROPAGATION_CHUNK_SIZE } from './sql-helpers.js'
import { toReconhecimentoRow } from './row-mappers.js'
import {
  assertRecognitionCapacity,
  DatabaseRowNotFoundError,
  lockRecognitionOrder,
  readRecognitionCapacityRows,
} from './orders/orders.repository.js'
import type {
  NewReconhecimentoInput,
  PropagateReconhecimentoInput,
  ReconhecimentoPatch,
  ReconhecimentoRow,
} from '../types.js'

const mssql = createRequire(import.meta.url)('mssql') as typeof import('mssql')
const ORDERS_SCHEMA = 'dbo'
const ORDERS_TABLE = 'Order'
const RECONHECIMENTO_TABLE = 'Reconhecimento'

const RECONHECIMENTO_UPDATEABLE_COLUMNS = [
  { column: 'ID_Tp_Reconhecimento' as const, type: mssql.NVarChar },
  { column: 'DT_Reconhecimento' as const, type: mssql.DateTime },
  { column: 'Valor_Reconhecimento' as const, type: mssql.Money },
]

export async function fetchReconhecimentos(
  pool: ConnectionPool,
  orderId: number,
): Promise<ReconhecimentoRow[]> {
  const request = pool.request()
  request.input('orderId', mssql.Int, orderId)
  const sql = `SELECT
    ID_Reconhecimento, ID_Order, ID_Tp_Reconhecimento, DT_Reconhecimento,
    Valor_Reconhecimento, ID_User, DT_User
  FROM [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}]
  WHERE ID_Order = @orderId
  ORDER BY ID_Reconhecimento ASC`
  const result = await request.query<Record<string, unknown>>(sql)
  return Array.from(result.recordset).map(toReconhecimentoRow)
}

export class PropagationValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PropagationValidationError'
  }
}

export async function addReconhecimento(
  pool: ConnectionPool,
  input: NewReconhecimentoInput,
  user: string,
): Promise<ReconhecimentoRow> {
  const transaction = pool.transaction()
  await transaction.begin()
  try {
    const order = await lockRecognitionOrder(transaction, input.ID_Order)
    const existingRows = await readRecognitionCapacityRows(transaction, input.ID_Order)
    assertRecognitionCapacity(
      order,
      existingRows,
      input.ID_Tp_Reconhecimento,
      input.Valor_Reconhecimento,
    )
    const request = transaction.request()
    request.input('orderId', mssql.Int, input.ID_Order)
    request.input('type', mssql.NVarChar, input.ID_Tp_Reconhecimento)
    request.input('date', mssql.DateTime, input.DT_Reconhecimento)
    request.input('value', mssql.Money, input.Valor_Reconhecimento)
    request.input('user', mssql.NVarChar, user)
    const inserted = await request.query<Record<string, unknown>>(
      `INSERT INTO [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}]
        (ID_Order, ID_Tp_Reconhecimento, DT_Reconhecimento, Valor_Reconhecimento, ID_User, DT_User)
       OUTPUT INSERTED.ID_Reconhecimento, INSERTED.ID_Order,
              INSERTED.ID_Tp_Reconhecimento, INSERTED.DT_Reconhecimento,
              INSERTED.Valor_Reconhecimento, INSERTED.ID_User, INSERTED.DT_User
       VALUES (@orderId, @type, @date, @value, @user, GETUTCDATE())`,
    )
    const row = inserted.recordset[0]
    if (!row) throw new Error('The database did not return the recognition row.')
    await transaction.commit()
    return toReconhecimentoRow(row)
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function updateReconhecimento(
  pool: ConnectionPool,
  id: number,
  patch: ReconhecimentoPatch,
  user: string,
): Promise<ReconhecimentoRow | null> {
  const transaction = pool.transaction()
  await transaction.begin()
  try {
    const initialRequest = transaction.request()
    initialRequest.input('id', mssql.Int, id)
    const initial = await initialRequest.query<Record<string, unknown>>(
      `SELECT ID_Order FROM [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}] WHERE ID_Reconhecimento = @id`,
    )
    const orderId = numberOrNull(initial.recordset[0]?.ID_Order)
    if (orderId === null) {
      await transaction.rollback()
      return null
    }
    const order = await lockRecognitionOrder(transaction, orderId)
    const currentRequest = transaction.request()
    currentRequest.input('id', mssql.Int, id)
    const currentResult = await currentRequest.query<Record<string, unknown>>(
      `SELECT ID_Reconhecimento, ID_Order, ID_Tp_Reconhecimento, DT_Reconhecimento,
              Valor_Reconhecimento, ID_User, DT_User
       FROM [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}] WITH (UPDLOCK, HOLDLOCK)
       WHERE ID_Reconhecimento = @id`,
    )
    const currentRaw = currentResult.recordset[0]
    if (!currentRaw || numberOrNull(currentRaw.ID_Order) !== orderId) {
      await transaction.rollback()
      return null
    }
    const current = toReconhecimentoRow(currentRaw)
    const type = patch.ID_Tp_Reconhecimento ?? current.ID_Tp_Reconhecimento
    const date = patch.DT_Reconhecimento ?? current.DT_Reconhecimento
    const value = patch.Valor_Reconhecimento ?? current.Valor_Reconhecimento
    if (type === null || date === null || value === null)
      throw new Error('Recognition rows require type, date, and value.')
    const existingRows = await readRecognitionCapacityRows(transaction, orderId, id)
    assertRecognitionCapacity(order, existingRows, type, value)
    const request = transaction.request()
    request.input('id', mssql.Int, id)
    request.input('user', mssql.NVarChar, user)
    const setClauses: string[] = []
    for (const { column, type: sqlType } of RECONHECIMENTO_UPDATEABLE_COLUMNS) {
      if (column in patch) {
        setClauses.push(`${column} = @${column}`)
        request.input(column, sqlType, patch[column])
      }
    }
    setClauses.push('ID_User = @user', 'DT_User = GETUTCDATE()')
    const updated = await request.query<Record<string, unknown>>(
      `UPDATE [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}]
       SET ${setClauses.join(', ')}
       OUTPUT INSERTED.ID_Reconhecimento, INSERTED.ID_Order,
              INSERTED.ID_Tp_Reconhecimento, INSERTED.DT_Reconhecimento,
              INSERTED.Valor_Reconhecimento, INSERTED.ID_User, INSERTED.DT_User
       WHERE ID_Reconhecimento = @id`,
    )
    const row = updated.recordset[0]
    if (!row) {
      await transaction.rollback()
      return null
    }
    await transaction.commit()
    return toReconhecimentoRow(row)
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

export async function deleteReconhecimento(pool: ConnectionPool, id: number): Promise<boolean> {
  const request = pool.request()
  request.input('id', mssql.Int, id)
  const result = await request.query(
    `DELETE FROM [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}] WHERE ID_Reconhecimento = @id`,
  )
  return (result.rowsAffected[0] ?? 0) > 0
}

export async function propagateReconhecimento(
  pool: ConnectionPool,
  input: PropagateReconhecimentoInput,
  user: string,
): Promise<ReconhecimentoRow[]> {
  const transaction = pool.transaction()
  await transaction.begin()
  try {
    const request = transaction.request()
    request.input('orderId', mssql.Int, input.orderId)
    const orderResult = await request.query<Record<string, unknown>>(
      `SELECT o.ID_Order, o.ID_Tipo, t.Warranty AS Tipo_Warranty,
              o.Sell_Price, o.Warranty_Reserve, o.Warranty_DT_Inicio,
              tw.N_Anos
       FROM [${ORDERS_SCHEMA}].[${ORDERS_TABLE}] AS o WITH (UPDLOCK, HOLDLOCK)
       LEFT JOIN [${ORDERS_SCHEMA}].[Tipo] AS t ON o.ID_Tipo = t.ID_Tipo
       LEFT JOIN [${ORDERS_SCHEMA}].[Tp_Warranty] AS tw ON o.ID_Tp_Warranty = tw.ID_Tp_Warranty
       WHERE o.ID_Order = @orderId`,
    )
    const order = orderResult.recordset[0]
    if (!order) throw new DatabaseRowNotFoundError(`Order ${input.orderId} was not found.`)
    const lines = planPropagationLines(order, input)
    if (lines.length === 0) {
      await transaction.commit()
      return []
    }
    const existingRows = await readRecognitionCapacityRows(transaction, input.orderId)
    const plannedTotal = lines.reduce((sum, line) => sum + line.value, 0)
    assertRecognitionCapacity(order, existingRows, lines[0]?.type ?? '', plannedTotal)
    const created: ReconhecimentoRow[] = []
    for (let offset = 0; offset < lines.length; offset += PROPAGATION_CHUNK_SIZE) {
      const chunk = lines.slice(offset, offset + PROPAGATION_CHUNK_SIZE)
      const insertRequest = transaction.request()
      insertRequest.input('orderId', mssql.Int, input.orderId)
      insertRequest.input('type', mssql.NVarChar, chunk[0]?.type)
      insertRequest.input('user', mssql.NVarChar, user)
      const values = chunk.map((line, index) => {
        insertRequest.input(`date${index}`, mssql.DateTime, line.date)
        insertRequest.input(`value${index}`, mssql.Money, line.value)
        return `(@orderId, @type, @date${index}, @value${index}, @user, GETUTCDATE())`
      })
      const inserted = await insertRequest.query<Record<string, unknown>>(
        `INSERT INTO [${ORDERS_SCHEMA}].[${RECONHECIMENTO_TABLE}]
          (ID_Order, ID_Tp_Reconhecimento, DT_Reconhecimento, Valor_Reconhecimento, ID_User, DT_User)
         OUTPUT INSERTED.ID_Reconhecimento, INSERTED.ID_Order,
                INSERTED.ID_Tp_Reconhecimento, INSERTED.DT_Reconhecimento,
                INSERTED.Valor_Reconhecimento, INSERTED.ID_User, INSERTED.DT_User
         VALUES ${values.join(', ')}`,
      )
      created.push(...inserted.recordset.map(toReconhecimentoRow))
    }
    if (created.length !== lines.length)
      throw new Error('The database did not return every propagated recognition row.')
    await transaction.commit()
    return created.sort((left, right) => {
      const byDate = (left.DT_Reconhecimento ?? '').localeCompare(right.DT_Reconhecimento ?? '')
      return byDate !== 0 ? byDate : left.ID_Reconhecimento - right.ID_Reconhecimento
    })
  } catch (error) {
    await transaction.rollback().catch(() => undefined)
    throw error
  }
}

type PropagationLine = { type: 'WP' | 'CM'; date: Date; value: number }
function planPropagationLines(
  order: Record<string, unknown>,
  input: PropagateReconhecimentoInput,
): PropagationLine[] {
  if (input.kind === 'warranty') {
    if (booleanOrNull(order.Tipo_Warranty) !== true)
      throw new PropagationValidationError('Este tipo de pedido não tem garantia.')
    const warrantyReserve = numberOrNull(order.Warranty_Reserve)
    const start = dateOrNull(order.Warranty_DT_Inicio)
    const years = numberOrNull(order.N_Anos)
    if (warrantyReserve === null || warrantyReserve <= 0 || start === null || years === null) {
      throw new PropagationValidationError(
        'Warranty Reserve, início e duração da garantia são obrigatórios.',
      )
    }
    const months = (years - 1) * 12
    if (months <= 0) return []
    const values = allocateMoney(warrantyReserve, months)
    const first = addUtcMonths(firstUtcMonth(start), 12)
    return values.map((value, index) => ({ type: 'WP', date: addUtcMonths(first, index), value }))
  }
  return planMaintenanceContract(order, input)
}

function planMaintenanceContract(
  order: Record<string, unknown>,
  input: Extract<PropagateReconhecimentoInput, { kind: 'maintenance' }>,
): PropagationLine[] {
  if (stringOrNull(order.ID_Tipo) !== 'CM')
    throw new PropagationValidationError('A propagação de contrato só se aplica ao tipo CM.')
  const sellPrice = numberOrNull(order.Sell_Price)
  const start = dateOrNull(input.startDate)
  const recognitionDate = dateOrNull(input.recognitionDate)
  if (sellPrice === null || sellPrice <= 0 || start === null || recognitionDate === null) {
    throw new PropagationValidationError(
      'Sell Price, início do contrato e data de reconhecimento são obrigatórios.',
    )
  }
  const months = input.years * 12
  const values = allocateMoney(sellPrice, months)
  const contractStart = firstUtcMonth(start)
  const recognitionMonth = firstUtcMonth(recognitionDate)
  return values.map((value, index) => {
    const scheduled = addUtcMonths(contractStart, index)
    return {
      type: 'CM',
      date: scheduled.getTime() < recognitionMonth.getTime() ? recognitionMonth : scheduled,
      value,
    }
  })
}

function allocateMoney(total: number, count: number): number[] {
  const totalUnits = Math.round(total * 10_000)
  const baseUnits = Math.floor(totalUnits / count)
  const remainder = totalUnits - baseUnits * count
  return Array.from(
    { length: count },
    (_, index) => (baseUnits + (index < remainder ? 1 : 0)) / 10_000,
  )
}
function dateOrNull(value: unknown): Date | null {
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null
  return date !== null && !Number.isNaN(date.getTime()) ? date : null
}
function firstUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}
function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
}
