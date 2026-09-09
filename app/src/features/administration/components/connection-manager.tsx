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
import { selectDatabase } from '@/features/administration/api/admin-api'
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

export function ConnectionManager({ onSourceChange }: { onSourceChange?: (source: ConnectionSource | null) => void }) {
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
  const [operationMessage, setOperationMessage] = useState<string | null>(null)
  const [selectionScope, setSelectionScope] = useState<'session' | 'global'>('session')

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
      profiles.find((profile) => profile.active)?.id ??
      (lastManagedProfileId && profiles.some((profile) => profile.id === lastManagedProfileId)
        ? lastManagedProfileId
        : profiles[0].id)
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
  ): Promise<{ success: boolean; table: DatabaseTable | null }> {
    setOperationError(null)
    setOperationMessage(null)
    setConnectedSource(null)
    onSourceChange?.(null)
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
      onSourceChange?.(source)
      if ('profileId' in source) rememberManagedProfile(source.profileId)
      return { success: true, table: initialTable ?? null }
    } catch (error) {
      setOperationError(errorMessage(error))
      return { success: false, table: null }
    }
  }

  async function applyApplicationDatabase(source: ConnectionSource) {
    try {
      const result = await selectDatabase(
        source,
        selectionScope,
        effectiveToken,
        'credentials' in source ? form.getValues('name').trim() : undefined,
      )
      if (result.selectionToken) window.sessionStorage.setItem('omp.database-selection', result.selectionToken)
      else window.sessionStorage.removeItem('omp.database-selection')
      setOperationMessage(
        selectionScope === 'global'
          ? 'Database connected globally. All users will use this database.'
          : 'Database connected for this session.',
      )
    } catch (error) {
      setOperationError(errorMessage(error))
      setOperationMessage(null)
    }
  }

  async function connectAdHoc(values: ConnectionFormValues) {
    const id = savedProfileId || newConnectionId()
    const profile = toProfile(id, values)
    saveProfile(profile)
    setSavedProfileId(id)

    const connection = {
      credentials: {
        server: values.server.trim(),
        port: values.port,
        ...(values.database.trim() ? { database: values.database.trim() } : {}),
        user: values.user.trim(),
        password: values.password,
      },
    }
    const result = await connectSource(
      connection,
      values.table.trim() || undefined,
    )

    if (result.success) {
      await applyApplicationDatabase(connection)
    }
    if (result.table) {
      saveProfile({
        ...profile,
        schema: result.table.schema,
        table: result.table.name,
      })
    }
  }

  function submitConnection(event: FormEvent<HTMLFormElement>) {
    if (managedMode) {
      event.preventDefault()
      void connectSource({ profileId: managedProfileId }).then((result) => {
        if (result.success) void applyApplicationDatabase({ profileId: managedProfileId })
      })
      return
    }
    void form.handleSubmit(connectAdHoc)(event)
  }

  async function syncSelectedTable() {
    if (!connectedSource || !selectedTable) return
    setOperationError(null)
    setOperationMessage(null)
    try {
      const result = await syncMutation.mutateAsync({
        source: connectedSource,
        schema: selectedTable.schema,
        table: selectedTable.name,
        limit: 200,
      })
      setSyncResult(result)
      setOperationMessage('Selected table synchronized successfully.')
      rememberSync()
    } catch (error) {
      setOperationError(errorMessage(error))
      setSyncResult(null)
    }
  }

  async function syncAllTablesNow() {
    if (!connectedSource) return
    setOperationError(null)
    setOperationMessage(null)
    setSyncResult(null)
    try {
      const result = await syncAllMutation.mutateAsync({ source: connectedSource, limit: 200 })
      setSyncAllResult(result)
      setOperationMessage(`${result.tables.length} tables synchronized successfully.`)
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
    onSourceChange?.(null)
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
  const connectedManagedProfile = connectedSource && 'profileId' in connectedSource
    ? backendProfiles.data?.find((profile) => profile.id === connectedSource.profileId)
    : undefined

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

         {managedMode ? (
          <div className="mb-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-3 text-xs text-foreground/70">
            <p className="font-semibold text-foreground">Using backend-managed profile</p>
            <p className="mt-1">The Node API resolves the SQL Server credentials. They are never sent to this browser.</p>
            <p className="mt-1">Table maintenance and company settings use this same profile.</p>
          </div>
          ) : (
            <ConnectionConfigForm register={form.register} errors={form.formState.errors} />
          )}

        <div className="mt-3 rounded-md border border-border bg-surface-muted px-3 py-3">
          <label className="block text-[11px] font-medium uppercase tracking-wider text-foreground/50" htmlFor="database-scope">
            Use this database for
          </label>
          <Select id="database-scope" value={selectionScope} onChange={(event) => setSelectionScope(event.target.value as 'session' | 'global')} className="mt-1 max-w-xs">
            <option value="session">This session only (recommended)</option>
            <option value="global">Everyone using the server</option>
          </Select>
          <p className="mt-1 text-xs text-foreground/60">
            This choice applies when you click Connect. Global changes affect every active user.
          </p>
        </div>

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
           className="min-w-28"
          >
            {connectMutation.isPending ? (
              <RefreshCw className="size-4 animate-spin" aria-hidden />
            ) : (
              <PlugZap className="size-4" aria-hidden />
            )}
            {connectMutation.isPending ? 'Connecting...' : 'Connect'}
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
            className="min-w-28"
          >
            <RefreshCw
              className={`size-4${syncMutation.isPending || syncAllMutation.isPending ? ' animate-spin' : ''}`}
              aria-hidden
            />
            {syncMutation.isPending || syncAllMutation.isPending ? 'Syncing...' : 'Sync'}
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
            className="min-w-28"
          >
            <Trash2 className="size-4" aria-hidden />
            Remove
          </Button>
        </div>
        <p className="mt-2 text-xs text-foreground/60">
          {!canConnect
            ? 'Complete the connection fields before connecting.'
            : !connectedSource
              ? 'Connect first to enable synchronization.'
              : !syncAll && !selectedTable
                ? 'Select a table to enable synchronization.'
                : !savedProfileId
                  ? 'Select a saved profile to enable removal.'
                  : 'Ready.'}
        </p>
        {operationMessage && (
          <p role="status" className="mt-2 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
            {operationMessage}
          </p>
        )}
      </form>

      {connectedSource && (
        <section className="rounded-lg border border-success/25 bg-success/5 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-success">Current database</p>
              <h2 className="mt-1 text-base font-semibold text-foreground">
                {connectedManagedProfile?.name ?? ('profileId' in connectedSource ? connectedSource.profileId : connectedSource.credentials.database ?? 'SQL Server database')}
              </h2>
            </div>
            <Badge tone="success">Active</Badge>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <ConnectionDetail label="Server" value={connectedManagedProfile?.server ?? ('credentials' in connectedSource ? connectedSource.credentials.server : 'Backend managed')} />
            <ConnectionDetail label="Port" value={String(connectedManagedProfile?.port ?? ('credentials' in connectedSource ? connectedSource.credentials.port : ''))} />
            <ConnectionDetail label="Database" value={connectedManagedProfile?.database ?? ('credentials' in connectedSource ? connectedSource.credentials.database : undefined)} />
            <ConnectionDetail label="Username" value={connectedManagedProfile?.user ?? ('credentials' in connectedSource ? connectedSource.credentials.user : undefined)} />
          </dl>
          {'profileId' in connectedSource && (
            <p className="mt-3 text-xs text-foreground/60">Password is protected and managed by the server.</p>
          )}
        </section>
      )}

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

function ConnectionDetail({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="rounded-md border border-border/70 bg-surface px-3 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-foreground/50">{label}</dt>
      <dd className="mt-1 truncate font-medium text-foreground">{value || 'Not specified'}</dd>
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
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    return [...bytes]
      .map((byte, index) => `${byte.toString(16).padStart(2, '0')}${[3, 5, 7, 9].includes(index) ? '-' : ''}`)
      .join('')
  }
  return `connection-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
