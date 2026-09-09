import { AsyncLocalStorage } from 'node:async_hooks'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { NextFunction, Request, Response } from 'express'
import type { ConnectionConfig } from './types.js'

type Scope = 'session' | 'global'
const context = new AsyncLocalStorage<string | undefined>()
const sessionSelections = new Map<string, ConnectionConfig>()
let globalSelection: ConnectionConfig | undefined

export function setDatabaseSelection(
  connection: ConnectionConfig,
  scope: Scope,
  profileId?: string,
  profileName?: string,
): string | null {
  if (scope === 'global') {
    globalSelection = connection
    persistGlobalSelection(connection, profileId, profileName)
    return null
  }
  const token = randomBytes(32).toString('base64url')
  sessionSelections.set(token, connection)
  return token
}

function persistGlobalSelection(connection: ConnectionConfig, profileId?: string, profileName?: string): void {
  const envFile = resolve(process.cwd(), '.env')
  if (profileId) {
    updateEnvValue(envFile, 'ORDERS_PROFILE_ID', profileId)
    process.env.ORDERS_PROFILE_ID = profileId
    return
  }

  const runtimeId = 'app-global'
  const prefix = 'PROFILE__APP_GLOBAL__'
  updateEnvValue(envFile, 'PROFILES', addProfileId(readEnvValue(envFile, 'PROFILES'), runtimeId))
  updateEnvValue(envFile, 'ORDERS_PROFILE_ID', runtimeId)
  process.env.ORDERS_PROFILE_ID = runtimeId
  updateEnvValue(envFile, `${prefix}NAME`, profileName || 'Application global database')
  updateEnvValue(envFile, `${prefix}SERVER`, connection.server)
  updateEnvValue(envFile, `${prefix}PORT`, String(connection.port))
  updateEnvValue(envFile, `${prefix}USER`, connection.user)
  updateEnvValue(envFile, `${prefix}PASSWORD`, connection.password)
  updateEnvValue(envFile, `${prefix}DATABASE`, connection.database ?? '')
  updateEnvValue(envFile, `${prefix}TRUST_SERVER_CERTIFICATE`, String(connection.trustServerCertificate ?? false))
}

function updateEnvValue(file: string, key: string, value: string): void {
  let content: string
  try {
    content = readFileSync(file, 'utf8')
  } catch {
    content = ''
  }
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=.*$`, 'm')
  if (pattern.test(content)) content = content.replace(pattern, line)
  else content = `${content.trimEnd()}\n${line}\n`
  writeFileSync(file, content, { mode: 0o600 })
}

function readEnvValue(file: string, key: string): string {
  try {
    const line = readFileSync(file, 'utf8').split('\n').find((item) => item.startsWith(`${key}=`))
    return line?.slice(key.length + 1).trim() ?? ''
  } catch {
    return ''
  }
}

function addProfileId(value: string, id: string): string {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean).concat(id))].join(',')
}

export function runDatabaseSelectionContext(request: Request, _response: Response, next: NextFunction): void {
  const token = request.header('x-database-selection') ?? undefined
  context.run(token, next)
}

export function resolveSelectedDatabase(defaultConnection: ConnectionConfig): ConnectionConfig {
  const token = context.getStore()
  return (token ? sessionSelections.get(token) : undefined) ?? globalSelection ?? defaultConnection
}
