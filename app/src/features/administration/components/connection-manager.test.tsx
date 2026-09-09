import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { renderWithProviders } from '@/test/render-with-providers'
import type { DatabaseConnectionProfile } from '@/domain/models/database-connection-profile'
import { writeSavedConnection } from '@/features/administration/hooks/use-saved-connections'
import { ConnectionManager } from './connection-manager'

type TestUser = ReturnType<typeof renderWithProviders>['user']

const tables = [
  { schema: 'dbo', name: 'Orders', type: 'BASE TABLE' },
  { schema: 'reporting', name: 'V_Order_List', type: 'VIEW' },
]

const server = setupServer(
  http.get('*/api/admin/profiles', () => HttpResponse.json([])),
  http.post('*/api/admin/connect', () => HttpResponse.json({ ok: true, tables })),
  http.post('*/api/admin/database-selection', () =>
    HttpResponse.json({ ok: true, scope: 'session', selectionToken: 'test-selection-token' }),
  ),
  http.post('*/api/orders/sync', () =>
    HttpResponse.json({
      ok: true,
      columns: ['ID_Order', 'Client_Name'],
      rows: [{ ID_Order: 101, Client_Name: 'Acme Instruments' }],
    }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  window.localStorage.clear()
  window.sessionStorage.clear()
  vi.unstubAllGlobals()
})
afterAll(() => server.close())

beforeEach(() => {
  // Node's fetch requires absolute URLs; browsers resolve this API's same-origin
  // `/api` paths automatically. Keep MSW at the boundary by adding jsdom's origin.
  const interceptedFetch = globalThis.fetch
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? new URL(input, window.location.origin) : input
    return interceptedFetch(url, init)
  })
})

describe('ConnectionManager', () => {
  it('exposes accessible icon-only Connect, Sync, and Remove actions', () => {
    renderWithProviders(<ConnectionManager />)

    expect(screen.getByRole('button', { name: 'Connect to SQL Server' })).toHaveAttribute(
      'title',
      'Connect to SQL Server',
    )
    expect(screen.getByRole('button', { name: 'Sync selected orders table' })).toHaveAttribute(
      'title',
      'Sync selected orders table',
    )
    expect(screen.getByRole('button', { name: 'Remove saved connection' })).toHaveAttribute(
      'title',
      'Remove saved connection',
    )
    expect(screen.getByLabelText('Username')).toHaveAttribute('autocomplete', 'off')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'off')
  })

  it('shows the password toggle and the active database details', async () => {
    const { user } = renderWithProviders(<ConnectionManager />)
    await fillRequiredAdHocFields(user)

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Connect to SQL Server' }))

    expect(await screen.findByText('Current database')).toBeVisible()
    expect(screen.getByText('192.168.1.25')).toBeVisible()
    expect(screen.getByText('Not specified')).toBeVisible()
  })

  it('validates the SQL Server port before connecting', async () => {
    const { user } = renderWithProviders(<ConnectionManager />)
    await fillRequiredAdHocFields(user)

    const port = screen.getByLabelText('Port')
    await user.clear(port)
    await user.type(port, '70000')
    fireEvent.blur(port)

    expect(await screen.findByText('Port must be between 1 and 65535.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Connect to SQL Server' })).toBeDisabled()
  })

  it('connects with ad-hoc credentials and renders the table picker', async () => {
    const { user } = renderWithProviders(<ConnectionManager />)
    await fillRequiredAdHocFields(user)

    await user.click(screen.getByRole('button', { name: 'Connect to SQL Server' }))

    const picker = await screen.findByLabelText('Orders table')
    expect(picker).toHaveTextContent('dbo.Orders')
    expect(picker).toHaveTextContent('reporting.V_Order_List')
    expect(screen.getByText('Connected')).toBeVisible()
  })

  it('uses the ephemeral API token when connecting', async () => {
    let authorization: string | null = null
    server.use(
      http.post('*/api/admin/connect', ({ request }) => {
        authorization = request.headers.get('Authorization')
        return HttpResponse.json({ ok: true, tables })
      }),
    )
    const { user } = renderWithProviders(<ConnectionManager />)
    await enableApiToken(user)
    await user.type(screen.getByLabelText('API access token'), 'admin-secret')
    await fillRequiredAdHocFields(user)

    await user.click(screen.getByRole('button', { name: 'Connect to SQL Server' }))
    await screen.findByLabelText('Orders table')

    expect(authorization).toBe('Bearer admin-secret')
  })

  it('shows the backend connection message on failure', async () => {
    server.use(
      http.post('*/api/admin/connect', () =>
        HttpResponse.json(
          {
            ok: false,
            code: 'login-failed',
            message: 'Login failed. Check the username and password.',
          },
          { status: 502 },
        ),
      ),
    )
    const { user } = renderWithProviders(<ConnectionManager />)
    await fillRequiredAdHocFields(user)

    await user.click(screen.getByRole('button', { name: 'Connect to SQL Server' }))

    expect(await screen.findByText('Login failed. Check the username and password.')).toBeVisible()
    expect(screen.queryByText(/status code 502/i)).not.toBeInTheDocument()
  })

  it('syncs the selected table and renders its raw rows in the Orders tab', async () => {
    const { user } = renderWithProviders(<ConnectionManager />)
    await fillRequiredAdHocFields(user)
    await user.click(screen.getByRole('button', { name: 'Connect to SQL Server' }))

    await user.selectOptions(await screen.findByLabelText('Orders table'), '0')
    await user.click(screen.getByRole('button', { name: 'Sync selected orders table' }))

    expect(await screen.findByText('Acme Instruments')).toBeVisible()
    expect(screen.getByRole('table', { name: 'Synced orders' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Orders' })).toHaveAttribute('aria-selected', 'true')
  })

  it('syncs all tables and renders a tab per table', async () => {
    server.use(
      http.post('*/api/admin/sync-all', () =>
        HttpResponse.json({
          ok: true,
          tables: [
            { schema: 'dbo', name: 'Orders', columns: ['ID_Order'], rows: [{ ID_Order: 1 }] },
            { schema: 'dbo', name: 'Client', columns: ['ID_Client'], rows: [{ ID_Client: 9 }] },
          ],
        }),
      ),
    )
    const { user } = renderWithProviders(<ConnectionManager />)
    await fillRequiredAdHocFields(user)
    await user.click(screen.getByRole('button', { name: 'Connect to SQL Server' }))
    await screen.findByLabelText('Orders table')

    await user.click(screen.getByRole('checkbox', { name: /Sync all tables/ }))
    await user.click(screen.getByRole('button', { name: 'Sync all tables' }))

    expect(await screen.findByRole('tab', { name: /^Orders/ })).toBeVisible()
    expect(screen.getByRole('tab', { name: /^Client/ })).toBeVisible()
  })

  it('never persists database or API secrets when saving an ad-hoc profile', async () => {
    const { user } = renderWithProviders(<ConnectionManager />)
    await enableApiToken(user)
    await user.type(screen.getByLabelText('API access token'), 'api-token-not-persisted')
    await fillRequiredAdHocFields(user, 'must-not-be-persisted')
    await user.click(screen.getByRole('button', { name: 'Connect to SQL Server' }))
    await screen.findByLabelText('Orders table')

    await waitFor(() => {
      const stored = window.localStorage.getItem('omp.database-connections')
      expect(stored).not.toContain('must-not-be-persisted')
      expect(stored).not.toContain('api-token-not-persisted')
    })
  })

  it('removes a saved ad-hoc profile from the dropdown and storage', async () => {
    const profile: DatabaseConnectionProfile = {
      id: 'development-sql',
      name: 'Development SQL',
      networkMode: 'lan',
      server: '192.168.1.25',
      port: 1433,
      database: 'Orders',
      user: 'orders_app',
    }
    writeSavedConnection(window.localStorage, profile)
    const { user } = renderWithProviders(<ConnectionManager />)

    await user.selectOptions(screen.getByLabelText('Saved ad-hoc profile'), profile.id)
    await user.click(screen.getByRole('button', { name: 'Remove saved connection' }))

    expect(screen.getByLabelText('Saved ad-hoc profile')).not.toHaveTextContent(profile.name)
    expect(window.localStorage.getItem('omp.database-connections')).toBe('[]')
  })

  it('reloads managed profiles after an ephemeral API token is entered', async () => {
    server.use(
      http.get('*/api/admin/profiles', ({ request }) => {
        if (request.headers.get('Authorization') !== 'Bearer admin-secret') {
          return HttpResponse.json(
            {
              ok: false,
              code: 'unauthorized',
              message: 'Administrator authentication is required.',
            },
            { status: 401 },
          )
        }
        return HttpResponse.json([
          { id: 'production', name: 'Portugal Production', networkMode: 'private-remote' },
        ])
      }),
    )
    const { user } = renderWithProviders(<ConnectionManager />)
    await screen.findByText(/Administrator authentication is required/)

    await enableApiToken(user)
    await user.type(screen.getByLabelText('API access token'), 'admin-secret')
    await user.tab()

    expect(await screen.findByRole('option', { name: /Portugal Production/ })).toBeVisible()
  })

  it('connects through a backend-managed profile without exposing form credentials', async () => {
    let requestBody: unknown
    server.use(
      http.get('*/api/admin/profiles', () =>
        HttpResponse.json([
          { id: 'production', name: 'Portugal Production', networkMode: 'private-remote' },
        ]),
      ),
      http.post('*/api/admin/connect', async ({ request }) => {
        requestBody = await request.json()
        return HttpResponse.json({ ok: true, tables })
      }),
    )
    const { user } = renderWithProviders(<ConnectionManager />)

    await screen.findByRole('option', { name: /Portugal Production/ })
    await user.selectOptions(screen.getByLabelText('Backend-managed profile'), 'production')
    await user.click(screen.getByRole('button', { name: 'Connect to SQL Server' }))
    await screen.findByLabelText('Orders table')

    expect(requestBody).toEqual({ profileId: 'production' })
    expect(JSON.stringify(requestBody)).not.toContain('password')
  })

  it('auto-connects the first managed profile on mount with no click (tokenless)', async () => {
    let requestBody: unknown
    server.use(
      http.get('*/api/admin/profiles', () =>
        HttpResponse.json([{ id: 'demo-primary', name: 'OMP Demo', networkMode: 'lan' }]),
      ),
      http.post('*/api/admin/connect', async ({ request }) => {
        requestBody = await request.json()
        return HttpResponse.json({ ok: true, tables })
      }),
    )
    renderWithProviders(<ConnectionManager />)

    // Auto-connect fires on mount — the table picker and "Connected" badge appear
    // without the user clicking Connect.
    expect(await screen.findByText('Connected')).toBeVisible()
    expect(await screen.findByLabelText('Orders table')).toBeVisible()
    expect(requestBody).toEqual({ profileId: 'demo-primary' })
  })

  it('auto-connects the managed profile remembered from a previous session', async () => {
    let requestBody: unknown
    server.use(
      http.get('*/api/admin/profiles', () =>
        HttpResponse.json([
          { id: 'staging', name: 'Staging', networkMode: 'lan' },
          { id: 'demo-primary', name: 'OMP Demo', networkMode: 'lan' },
        ]),
      ),
      http.post('*/api/admin/connect', async ({ request }) => {
        requestBody = await request.json()
        return HttpResponse.json({ ok: true, tables })
      }),
    )
    // Preference seeded from a prior session — the first listed profile would
    // otherwise be picked, but the remembered id wins.
    window.localStorage.setItem(
      'omp.admin-connection-preference',
      JSON.stringify({ lastManagedProfileId: 'demo-primary' }),
    )
    renderWithProviders(<ConnectionManager />)

    expect(await screen.findByText('Connected')).toBeVisible()
    expect(requestBody).toEqual({ profileId: 'demo-primary' })
  })

  it('records and shows the last-sync time after a successful sync', async () => {
    const { user } = renderWithProviders(<ConnectionManager />)
    await fillRequiredAdHocFields(user)
    await user.click(screen.getByRole('button', { name: 'Connect to SQL Server' }))
    await screen.findByLabelText('Orders table')
    await user.selectOptions(await screen.findByLabelText('Orders table'), '0')
    await user.click(screen.getByRole('button', { name: 'Sync selected orders table' }))
    await screen.findByText('Acme Instruments')

    expect(await screen.findByText(/Last sync:/)).toBeVisible()
    const stored = window.localStorage.getItem('omp.admin-connection-preference')
    expect(stored).toContain('lastSyncAt')
  })
})

async function fillRequiredAdHocFields(user: TestUser, password = 'secret') {
  await user.type(screen.getByLabelText('Profile name'), 'Development SQL')
  await user.type(screen.getByLabelText('Server'), '192.168.1.25')
  await user.type(screen.getByLabelText('Username'), 'orders_app')
  await user.type(screen.getByLabelText('Password'), password)
}

async function enableApiToken(user: TestUser) {
  await user.click(screen.getByRole('checkbox', { name: /Require API access token/ }))
}
