import { useEffect, useRef, useState, type FormEvent } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Database, Plus, PlugZap, RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { DatabaseConnectionProfile } from '@/domain/models/database-connection-profile'
import type {
  ConnectionSource,
  DatabaseTable,
  SyncAllResult,
  SyncResult,
} from '@/features/administration/api/admin-api'
import {
  useBackendProfiles,
  useConnectionActions,
} from '@/features/administration/hooks/use-connection-actions'
import { useSavedConnections } from '@/features/administration/hooks/use-saved-connections'
import { useConnectionPreference } from '@/features/administration/hooks/use-connection-preference'
import { ConnectionConfigForm } from './connection-config-form'
import { connectionFormSchema, type ConnectionFormValues } from './connection-form-schema'
import { SyncedOrdersPanel, SyncedTablesPanel } from './synced-orders-panel'
import { TablesPicker } from './tables-picker'

const defaultValues: ConnectionFormValues = {
  name: '',
  networkMode: 'lan',
  server: '',
  port: 1433,
  database: '',
  user: '',
  password: '',
  table: '',
}

export function ConnectionManager() {
  const { profiles: savedProfiles, saveProfile, removeProfile } = useSavedConnections()
  const { lastManagedProfileId, lastSyncAt, rememberManagedProfile, rememberSync } =
    useConnectionPreference()
  const [requireToken, setRequireToken] = useState(false)
  const [adminToken, setAdminToken] = useState('')
  const effectiveToken = requireToken ? adminToken : undefined
  const backendProfiles = useBackendProfiles(effectiveToken)
  const { connectMutation, syncMutation, syncAllMutation } = useConnectionActions(effectiveToken)
  const [managedProfileId, setManagedProfileId] = useState('')
  const [savedProfileId, setSavedProfileId] = useState('')
  const [tables, setTables] = useState<DatabaseTable[]>([])
  const [selectedTable, setSelectedTable] = useState<DatabaseTable | null>(null)
  const [connectedSource, setConnectedSource] = useState<ConnectionSource | null>(null)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncAllResult, setSyncAllResult] = useState<SyncAllResult | null>(null)
  const [syncAll, setSyncAll] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)

  // Auto-connect on launch: once backend-managed profiles are known and the tab is in
  // tokenless (loopback dev) mode, connect the last-used managed profile — or the
  // first available — so the database shows as "Connected" with zero clicks. Insecure
  // (token-required) mode stays manual. Runs at most once per mount.
  const autoConnectAttempted = useRef(false)
  useEffect(() => {
    if (autoConnectAttempted.current) return
    if (backendProfiles.isLoading || backendProfiles.isPending) return
    const profiles = backendProfiles.data
    if (!profiles || profiles.length === 0) return
    autoConnectAttempted.current = true
    if (requireToken) return
    const preferred =
      lastManagedProfileId && profiles.some((profile) => profile.id === lastManagedProfileId)
        ? lastManagedProfileId
        : profiles[0].id
    selectManagedProfile(preferred)
    void connectSource({ profileId: preferred })
    // selectManagedProfile/connectSource are component-local closures; the ref guard
    // makes this fire once on mount, so they're intentionally omitted from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendProfiles.isLoading, backendProfiles.data, requireToken, lastManagedProfileId])

  const form = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionFormSchema),
    defaultValues,
    mode: 'onChange',
  })

  const managedMode = managedProfileId !== ''
  const canConnect = managedMode || form.formState.isValid
  const canSync = syncAll
    ? connectedSource !== null
    : connectedSource !== null && selectedTable !== null

  async function connectSource(
    source: ConnectionSource,
    tableHint?: string,
  ): Promise<DatabaseTable | null> {
    setOperationError(null)
    setConnectedSource(null)
    setSyncResult(null)
    setSyncAllResult(null)
    setTables([])
    setSelectedTable(null)

    try {
      const result = await connectMutation.mutateAsync(source)
      const hinted = tableHint
        ? result.tables.find((table) => table.name.toLowerCase() === tableHint.toLowerCase())
        : undefined
      const initialTable = hinted ?? (result.tables.length === 1 ? result.tables[0] : null)

      setTables(result.tables)
      setSelectedTable(initialTable ?? null)
      setConnectedSource(source)
      if ('profileId' in source) rememberManagedProfile(source.profileId)
      return initialTable ?? null
    } catch (error) {
      setOperationError(errorMessage(error))
      return null
    }
  }

  async function connectAdHoc(values: ConnectionFormValues) {
    const id = savedProfileId || newConnectionId()
    const profile = toProfile(id, values)
    saveProfile(profile)
    setSavedProfileId(id)

    const initialTable = await connectSource(
      {
        credentials: {
          server: values.server.trim(),
          port: values.port,
          ...(values.database.trim() ? { database: values.database.trim() } : {}),
          user: values.user.trim(),
          password: values.password,
        },
      },
      values.table.trim() || undefined,
    )

    if (initialTable) {
      saveProfile({
        ...profile,
        schema: initialTable.schema,
        table: initialTable.name,
      })
    }
  }

  function submitConnection(event: FormEvent<HTMLFormElement>) {
    if (managedMode) {
      event.preventDefault()
      void connectSource({ profileId: managedProfileId })
      return
    }
    void form.handleSubmit(connectAdHoc)(event)
  }

  async function syncSelectedTable() {
    if (!connectedSource || !selectedTable) return
    setOperationError(null)
    try {
      const result = await syncMutation.mutateAsync({
        source: connectedSource,
        schema: selectedTable.schema,
        table: selectedTable.name,
        limit: 200,
      })
      setSyncResult(result)
      rememberSync()
    } catch (error) {
      setOperationError(errorMessage(error))
      setSyncResult(null)
    }
  }

  async function syncAllTablesNow() {
    if (!connectedSource) return
    setOperationError(null)
    setSyncResult(null)
    try {
      const result = await syncAllMutation.mutateAsync({ source: connectedSource, limit: 200 })
      setSyncAllResult(result)
      rememberSync()
    } catch (error) {
      setOperationError(errorMessage(error))
      setSyncAllResult(null)
    }
  }

  function selectManagedProfile(profileId: string) {
    setManagedProfileId(profileId)
    if (profileId) {
      setSavedProfileId('')
      form.setValue('password', '')
    }
    resetConnectionState()
  }

  function selectSavedProfile(profileId: string) {
    setSavedProfileId(profileId)
    setManagedProfileId('')
    const profile = savedProfiles.find((item) => item.id === profileId)
    form.reset(profile ? formValuesFor(profile) : defaultValues)
    resetConnectionState()
  }

  function startNewProfile() {
    setManagedProfileId('')
    setSavedProfileId('')
    form.reset(defaultValues)
    resetConnectionState()
  }

  function removeSavedProfile() {
    if (!savedProfileId) return
    removeProfile(savedProfileId)
    startNewProfile()
  }

  function selectTable(table: DatabaseTable | null) {
    setSelectedTable(table)
    setSyncResult(null)
    setSyncAllResult(null)
    form.setValue('table', table?.name ?? '')

    if (!table || !savedProfileId) return
    const profile = savedProfiles.find((item) => item.id === savedProfileId)
    if (profile) saveProfile({ ...profile, schema: table.schema, table: table.name })
  }

  function resetConnectionState() {
    setTables([])
    setSelectedTable(null)
    setConnectedSource(null)
    setSyncResult(null)
    setSyncAllResult(null)
    setOperationError(null)
    connectMutation.reset()
    syncMutation.reset()
    syncAllMutation.reset()
  }

  const status = connectionStatus({
    connecting: connectMutation.isPending,
    syncing: syncMutation.isPending || syncAllMutation.isPending,
    connected: connectedSource !== null,
    synced: syncResult !== null || syncAllResult !== null,
    failed: operationError !== null,
  })

  return (
    <div className="space-y-4">
      <form
        onSubmit={submitConnection}
        autoComplete="off"
        className="rounded-lg border border-border bg-surface p-4 shadow-sm"
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Database className="mt-0.5 size-5 text-primary" aria-hidden />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Connection profile</h2>
              <p className="text-xs text-foreground/60">
                SQL Server stays reachable through LAN, private networking, or an approved cloud
                network.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge tone={status.tone}>{status.label}</Badge>
            {lastSyncAt && (
              <span className="text-[11px] text-foreground/50">Last sync: {formatSyncTime(lastSyncAt)}</span>
            )}
          </div>
        </div>

        <div className="mb-4 border-b border-border pb-4">
          <label className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-foreground/50">
            <input
              type="checkbox"
              checked={requireToken}
              onChange={(event) => {
                setRequireToken(event.target.checked)
                void backendProfiles.refetch()
              }}
              className="size-3.5 accent-primary"
            />
            Require API access token
          </label>
          {requireToken ? (
            <>
              <label
                htmlFor="admin-api-token"
                className="mt-2 block text-[11px] font-medium uppercase tracking-wider text-foreground/50"
              >
                API access token
              </label>
              <Input
                id="admin-api-token"
                type="password"
                autoComplete="off"
                value={adminToken}
                onChange={(event) => setAdminToken(event.target.value)}
                onBlur={() => void backendProfiles.refetch()}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-foreground/50">
                Required by the API and kept in memory only.
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-foreground/50">
              Off — no token is sent. The API must be running without <code>ADMIN_API_TOKEN</code>{' '}
              (loopback dev only).
            </p>
          )}
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 border-b border-border pb-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="managed-profile"
              className="text-[11px] font-medium uppercase tracking-wider text-foreground/50"
            >
              Backend-managed profile
            </label>
            <Select
              id="managed-profile"
              value={managedProfileId}
              onChange={(event) => selectManagedProfile(event.target.value)}
              disabled={backendProfiles.isPending}
            >
              <option value="">Use ad-hoc credentials</option>
              {(backendProfiles.data ?? []).map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} · {networkLabel(profile.networkMode)}
                </option>
              ))}
            </Select>
            {backendProfiles.isError && (
              <p role="alert" className="text-xs text-warning">
                {backendProfiles.error instanceof Error
                  ? backendProfiles.error.message
                  : 'Managed profiles are unavailable. Ad-hoc connections still work.'}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="saved-profile"
                className="text-[11px] font-medium uppercase tracking-wider text-foreground/50"
              >
                Saved ad-hoc profile
              </label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={startNewProfile}
                className="h-6 px-1.5"
              >
                <Plus className="size-3.5" aria-hidden />
                New profile
              </Button>
            </div>
            <Select
              id="saved-profile"
              value={savedProfileId}
              onChange={(event) => selectSavedProfile(event.target.value)}
              disabled={managedMode}
            >
              <option value="">New ad-hoc profile</option>
              {savedProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {managedMode && (
          <p className="mb-3 rounded-md bg-primary/5 px-3 py-2 text-xs text-foreground/70">
            Credentials for this profile are resolved by the Node API and never sent to the browser.
          </p>
        )}

        <ConnectionConfigForm
          register={form.register}
          errors={form.formState.errors}
          disabled={managedMode}
        />

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button
            type="submit"
            aria-label="Connect to SQL Server"
            title="Connect to SQL Server"
            disabled={
              !canConnect ||
              connectMutation.isPending ||
              syncMutation.isPending ||
              syncAllMutation.isPending
            }
            className="w-9 px-0"
          >
            {connectMutation.isPending ? (
              <RefreshCw className="size-4 animate-spin" aria-hidden />
            ) : (
              <PlugZap className="size-4" aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            aria-label={syncAll ? 'Sync all tables' : 'Sync selected orders table'}
            title={syncAll ? 'Sync all tables' : 'Sync selected orders table'}
            disabled={
              !canSync ||
              connectMutation.isPending ||
              syncMutation.isPending ||
              syncAllMutation.isPending
            }
            onClick={() => void (syncAll ? syncAllTablesNow() : syncSelectedTable())}
            className="w-9 px-0"
          >
            <RefreshCw
              className={`size-4${syncMutation.isPending || syncAllMutation.isPending ? ' animate-spin' : ''}`}
              aria-hidden
            />
          </Button>
          <Button
            type="button"
            variant="danger"
            aria-label="Remove saved connection"
            title="Remove saved connection"
            disabled={
              !savedProfileId ||
              connectMutation.isPending ||
              syncMutation.isPending ||
              syncAllMutation.isPending
            }
            onClick={removeSavedProfile}
            className="w-9 px-0"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </form>

      {operationError && (
        <div
          role="alert"
          className="rounded-lg border border-danger/25 bg-danger/5 p-3 text-sm text-danger"
        >
          {operationError}
        </div>
      )}

      {connectedSource && (
        <>
          <label className="flex items-center gap-2 text-xs font-medium text-foreground/70">
            <input
              type="checkbox"
              checked={syncAll}
              onChange={(event) => {
                setSyncAll(event.target.checked)
                setSyncResult(null)
                setSyncAllResult(null)
              }}
              className="size-3.5 accent-primary"
            />
            Sync all tables
          </label>
          {!syncAll && (
            <TablesPicker tables={tables} selected={selectedTable} onChange={selectTable} />
          )}
        </>
      )}

      {syncResult && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <SyncedOrdersPanel result={syncResult} />
        </div>
      )}

      {syncAllResult && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <SyncedTablesPanel result={syncAllResult} />
        </div>
      )}
    </div>
  )
}

function toProfile(id: string, values: ConnectionFormValues): DatabaseConnectionProfile {
  return {
    id,
    name: values.name.trim(),
    networkMode: values.networkMode,
    server: values.server.trim(),
    port: values.port,
    ...(values.database.trim() ? { database: values.database.trim() } : {}),
    user: values.user.trim(),
    ...(values.table.trim() ? { table: values.table.trim() } : {}),
  }
}

function formValuesFor(profile: DatabaseConnectionProfile): ConnectionFormValues {
  return {
    name: profile.name,
    networkMode: profile.networkMode,
    server: profile.server,
    port: profile.port,
    database: profile.database ?? '',
    user: profile.user,
    password: '',
    table: profile.table ?? '',
  }
}

function newConnectionId(): string {
  return globalThis.crypto.randomUUID()
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The database operation failed.'
}

function networkLabel(mode: DatabaseConnectionProfile['networkMode']): string {
  if (mode === 'lan') return 'LAN'
  if (mode === 'private-remote') return 'Private remote / VPN'
  return 'Approved cloud network'
}

function connectionStatus(state: {
  connecting: boolean
  syncing: boolean
  connected: boolean
  synced: boolean
  failed: boolean
}): { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' } {
  if (state.connecting) return { label: 'Connecting…', tone: 'warning' }
  if (state.syncing) return { label: 'Syncing…', tone: 'warning' }
  if (state.failed) return { label: 'Failed', tone: 'danger' }
  if (state.synced) return { label: 'Synced', tone: 'success' }
  if (state.connected) return { label: 'Connected', tone: 'success' }
  return { label: 'Not connected', tone: 'neutral' }
}

// Display-only: render the stored UTC sync timestamp in the user's locale. Kept here
// rather than in utils/format.ts because it's specific to the Administration header.
function formatSyncTime(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(parsed)
}
