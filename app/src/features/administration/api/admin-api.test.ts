import { afterEach, describe, expect, it, vi } from 'vitest'
import { connect, listProfiles, syncAllTables, syncOrders } from './admin-api'

const credentials = {
  server: 'sql-orders.internal',
  port: 1433,
  database: 'Orders',
  user: 'orders_app',
  password: 'secret',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Administration API client', () => {
  it('lists backend-managed profile metadata', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            { id: 'production', name: 'Portugal Production', networkMode: 'private-remote' },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(listProfiles()).resolves.toEqual([
      { id: 'production', name: 'Portugal Production', networkMode: 'private-remote' },
    ])
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/profiles', {
      headers: { Accept: 'application/json' },
    })
  })

  it('sends the administrator token when listing managed profiles', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json([
        { id: 'production', name: 'Portugal Production', networkMode: 'private-remote' },
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    await listProfiles('admin-secret')

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/profiles', {
      headers: { Accept: 'application/json', Authorization: 'Bearer admin-secret' },
    })
  })

  it('sends ephemeral credentials only in the connection request', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, tables: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await connect({ credentials })

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/connect', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials }),
    })
  })

  it('sends an ephemeral administrator token only in the authorization header', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ ok: true, tables: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await connect({ credentials }, 'admin-secret')

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/connect', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-secret',
      },
      body: JSON.stringify({ credentials }),
    })
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).not.toHaveProperty('adminToken')
  })

  it('surfaces the backend message instead of a raw HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ok: false,
              code: 'login-failed',
              message: 'Login failed. Check the username and password.',
            }),
            { status: 502, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    )

    await expect(connect({ credentials })).rejects.toThrow(
      'Login failed. Check the username and password.',
    )
  })

  it('sends a backend profile id, selected table, and administrator token when syncing', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ ok: true, columns: ['ID_Order'], rows: [{ ID_Order: 10 }] }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await syncOrders(
      {
        source: { profileId: 'production' },
        schema: 'dbo',
        table: 'Orders',
        limit: 100,
      },
      'admin-secret',
    )

    expect(fetchMock).toHaveBeenCalledWith('/api/orders/sync', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-secret',
      },
      body: JSON.stringify({ profileId: 'production', schema: 'dbo', table: 'Orders', limit: 100 }),
    })
  })

  it('syncs every table through the sync-all endpoint with the admin token', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            tables: [
              {
                schema: 'dbo',
                name: 'Orders',
                columns: ['ID_Order'],
                rows: [{ ID_Order: 10 }],
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await syncAllTables(
      { source: { profileId: 'production' }, limit: 50 },
      'admin-secret',
    )

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/sync-all', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-secret',
      },
      body: JSON.stringify({ profileId: 'production', limit: 50 }),
    })
    expect(result.tables).toHaveLength(1)
    expect(result.tables[0]).toEqual({
      schema: 'dbo',
      name: 'Orders',
      columns: ['ID_Order'],
      rows: [{ ID_Order: 10 }],
    })
  })
})
