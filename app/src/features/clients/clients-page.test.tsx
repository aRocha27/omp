/**
 * Tests for ClientsPage.
 *
 * Clients are HTTP-only (no mock repository), so global `fetch` is stubbed — no
 * network. Mirrors the orders page-test approach but replaces the mock repository
 * with a fetch mock that returns client summaries.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { screen, within, fireEvent, waitFor } from '@testing-library/react'
import { ClientsPage } from '@/features/clients/clients-page'
import { renderWithProviders } from '@/test/render-with-providers'
import type { ClientSummary } from '@/domain/models/client'

const summaries: ClientSummary[] = [
  { ID_Cliente: 501, no_PHC: 7701, ID_Tp_Cliente: 1, nome: 'Client Alpha', ncont: 'PT5001', telefone: '+351210000000', local: 'Lisbon' },
  { ID_Cliente: 502, no_PHC: 7702, ID_Tp_Cliente: 2, nome: 'Client Beta', ncont: 'PT5002', telefone: '+351220000000', local: 'Porto' },
  { ID_Cliente: 503, no_PHC: null, ID_Tp_Cliente: null, nome: null, ncont: null, telefone: null, local: null },
]

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

/** Fetch stub: only `/api/clients/list` is expected. Returns all summaries unless a
 *  search filter is present, in which case it narrows by name contains (case-insensitive). */
function makeFetchMock(rows: ClientSummary[] = summaries) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    expect(url).toBe('/api/clients/list')
    const body = JSON.parse((init?.body as string) ?? '{}')
    const filters = body.filters ?? {}
    let filtered = rows
    if (typeof filters.search === 'string' && filters.search.length > 0) {
      const q = filters.search.toLowerCase()
      filtered = filtered.filter((c) => (c.nome ?? '').toLowerCase().includes(q))
    }
    return jsonResponse(200, { ok: true, clients: filtered })
  })
}

describe('ClientsPage', () => {
  let fetchMock: ReturnType<typeof makeFetchMock>

  beforeEach(() => {
    fetchMock = makeFetchMock()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the client rows from the live search endpoint', async () => {
    renderWithProviders(<ClientsPage />, { initialPath: '/clients' })

    expect(await screen.findByRole('table')).toBeInTheDocument()
    const rows = within(screen.getByRole('table')).getAllByRole('row')
    // 1 header row + 3 data rows
    expect(rows).toHaveLength(4)
    expect(screen.getByText('Client Alpha')).toBeInTheDocument()
    expect(screen.getByText('Client Beta')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Client totals' })).toHaveTextContent('Total clients3')
  })

  it('links each row to its client detail page with an accessible name', async () => {
    renderWithProviders(<ClientsPage />, { initialPath: '/clients' })
    await screen.findByRole('table')

    const link = screen.getByRole('link', { name: /View client Client Alpha details/ })
    expect(link).toHaveAttribute('href', '/clients/501')
  })

  it('falls back to the ID in the accessible name when nome is null', async () => {
    renderWithProviders(<ClientsPage />, { initialPath: '/clients' })
    await screen.findByRole('table')

    const link = screen.getByRole('link', { name: /View client 503 details/ })
    expect(link).toHaveAttribute('href', '/clients/503')
  })

  it('narrows results when the search filter changes', async () => {
    renderWithProviders(<ClientsPage />, { initialPath: '/clients' })
    await screen.findByRole('table')
    expect(screen.getByText('Client Alpha')).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText('Search by name, tax no., or SAP no.')
    fireEvent.change(searchInput, { target: { value: 'beta' } })

    // Beta remains, Alpha is filtered out by the fetch mock's name-contains match.
    expect(await screen.findByText('Client Beta')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText('Client Alpha')).not.toBeInTheDocument()
    })
    expect(screen.getByRole('region', { name: 'Client totals' })).toHaveTextContent('Total clients3')
  })

  it('renders the "No clients yet" empty state when there are no clients and no filters', async () => {
    fetchMock = vi.fn(async () => jsonResponse(200, { ok: true, clients: [] }))
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<ClientsPage />, { initialPath: '/clients' })

    expect(await screen.findByText('No clients yet')).toBeInTheDocument()
  })

  it('renders the "No clients match" empty state when filters narrow to nothing', async () => {
    // The fetch mock narrows by name-contains; a search that matches no row yields [].
    renderWithProviders(<ClientsPage />, { initialPath: '/clients' })
    await screen.findByRole('table')

    const searchInput = screen.getByPlaceholderText('Search by name, tax no., or SAP no.')
    fireEvent.change(searchInput, { target: { value: 'zzz' } })

    expect(await screen.findByText('No clients match these filters')).toBeInTheDocument()
  })

  it('renders the error state when the endpoint fails', async () => {
    fetchMock = vi.fn(async () =>
      jsonResponse(502, { ok: false, code: 'clients-not-configured', message: 'No clients profile.' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<ClientsPage />, { initialPath: '/clients' })

    expect(await screen.findByText(/Couldn’t load clients/)).toBeInTheDocument()
    expect(screen.getByText('No clients profile.')).toBeInTheDocument()
  })

  it('renders the loading state before the first fetch resolves', async () => {
    // A fetch that never resolves keeps the query pending.
    fetchMock = vi.fn(async () => new Promise<Response>(() => {}))
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<ClientsPage />, { initialPath: '/clients' })

    expect(screen.getByText('Loading clients…')).toBeInTheDocument()
  })
})
