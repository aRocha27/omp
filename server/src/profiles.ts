import type { ConnectionConfig, NetworkMode, ProfileMetadata } from './types.js'

type Environment = Record<string, string | undefined>

const DEFAULT_SQL_PORT = 1433
const NETWORK_MODES: readonly NetworkMode[] = ['lan', 'private-remote', 'cloud']

export class ProfileConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProfileConfigurationError'
  }
}

// Thrown when the Orders endpoints have no managed profile to read through. Distinct from
// ProfileConfigurationError (a known profile that is misconfigured) — this means there is
// no profile at all, so the Orders tab cannot function. Mapped to 502 orders-not-configured.
export class OrdersProfileNotConfiguredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrdersProfileNotConfiguredError'
  }
}

export function listProfileMetadata(environment: Environment = process.env): ProfileMetadata[] {
  return profileIds(environment).map((id) => {
    const prefix = profilePrefix(id)
    return {
      id,
      name: environment[`${prefix}NAME`]?.trim() || id,
      networkMode: readNetworkMode(
        environment[`${prefix}NETWORK_MODE`] ?? environment[`${prefix}NETWORK`],
        id,
      ),
    }
  })
}

export function resolveProfile(
  profileId: string,
  environment: Environment = process.env,
): ConnectionConfig {
  if (!profileIds(environment).includes(profileId)) {
    throw new ProfileConfigurationError(`Unknown connection profile: ${profileId}`)
  }

  const prefix = profilePrefix(profileId)
  const server = required(environment, `${prefix}SERVER`, profileId)
  const user = required(environment, `${prefix}USER`, profileId)
  const password = required(environment, `${prefix}PASSWORD`, profileId)
  const port = readPort(environment[`${prefix}PORT`], profileId)
  const database = environment[`${prefix}DATABASE`]?.trim() || undefined
  const encrypt = readOptionalBoolean(environment[`${prefix}ENCRYPT`], `${profileId} encrypt`)
  const trustServerCertificate = readOptionalBoolean(
    environment[`${prefix}TRUST_SERVER_CERTIFICATE`],
    `${profileId} trust-server-certificate`,
  )

  return {
    server,
    port,
    database,
    user,
    password,
    ...(encrypt === undefined ? {} : { encrypt }),
    ...(trustServerCertificate === undefined ? {} : { trustServerCertificate }),
  }
}

// The Orders endpoints have no credentials in their contract — the browser never sends a
// password. Instead the backend reads through a server-configured managed profile: the
// explicit ORDERS_PROFILE_ID, falling back to the first declared profile. Throws if no
// profile is configured at all. The password stays in env, never reaches the response.
export function resolveOrdersProfile(environment: Environment = process.env): ConnectionConfig {
  const ids = profileIds(environment)
  if (ids.length === 0) {
    throw new OrdersProfileNotConfiguredError(
      'No database connection profile is configured for the Orders endpoint.',
    )
  }
  const ordersId = environment.ORDERS_PROFILE_ID?.trim() || ids[0]
  return resolveProfile(ordersId, environment)
}

function profileIds(environment: Environment): string[] {
  return (environment.PROFILES ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value, index, values) => value !== '' && values.indexOf(value) === index)
}

function profilePrefix(id: string): string {
  const key = id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')
  return `PROFILE__${key}__`
}

function required(environment: Environment, key: string, profileId: string): string {
  const value = environment[key]?.trim()
  if (!value) {
    throw new ProfileConfigurationError(
      `Connection profile "${profileId}" is not configured correctly.`,
    )
  }
  return value
}

function readNetworkMode(value: string | undefined, profileId: string): NetworkMode {
  const mode = value?.trim() || 'lan'
  if (NETWORK_MODES.includes(mode as NetworkMode)) return mode as NetworkMode
  throw new ProfileConfigurationError(
    `Connection profile "${profileId}" has an invalid network mode.`,
  )
}

function readPort(value: string | undefined, profileId: string): number {
  const port = value === undefined || value.trim() === '' ? DEFAULT_SQL_PORT : Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ProfileConfigurationError(`Connection profile "${profileId}" has an invalid port.`)
  }
  return port
}

function readOptionalBoolean(value: string | undefined, label: string): boolean | undefined {
  if (value === undefined || value.trim() === '') return undefined
  if (value === 'true') return true
  if (value === 'false') return false
  throw new ProfileConfigurationError(`Connection profile ${label} must be true or false.`)
}
