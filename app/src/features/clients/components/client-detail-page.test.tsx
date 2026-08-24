/**
 * Tests for ClientDetailPage.
 *
 * Global `fetch` is stubbed — no network. Mirrors `order-detail-page.test.tsx`:
 * covers the found-detail render (heading + classification/contact/address
 * fields), the not-found state for a missing id, the not-found state for an
 * invalid non-numeric id, and the loading state.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { ClientDetailPage } from '@/features/clients/components/client-detail-page'
import { renderWithProviders } from '@/test/render-with-providers'
import type { Client } from '@/domain/models/client'

const detailRow: Client = {
  ID_Cliente: 501,
  no_PHC: 7701,
  ID_Tp_Cliente: 1,
  nome: 'Client Alpha',
  ncont: 'PT500123456',
  fax: '+351210000001',
  telefone: '+351210000000',
  contacto: 'Jane Doe',
  morada: 'Rua Maior 1',
  local: 'Lisbon',
  codpost: '1000-100',
  zona: 'Sul',
  Defense: false,
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('ClientDetailPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the client heading and resolved fields for a found client', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, client: detailRow }))

    renderWithProviders(<ClientDetailPage />, {
      initialPath: '/clients/501',
      routePath: '/clients/:id',
    })

    // Heading uses the client name (DB id is not user-facing).
    const heading = await screen.findByRole('heading', { name: /Client Alpha/ })
    expect(heading).toBeInTheDocument()

    // Client # shown in the header sub-line.
    expect(screen.getByText(/Client #501/)).toBeInTheDocument()

    // Contact section
    expect(screen.getByText('Phone')).toBeInTheDocument()
    expect(screen.getByText('+351210000000')).toBeInTheDocument()
    expect(screen.getByText('Fax')).toBeInTheDocument()
    expect(screen.getByText('+351210000001')).toBeInTheDocument()
    expect(screen.getByText('Contact name')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()

    // Address section
    expect(screen.getByText('Street address')).toBeInTheDocument()
    expect(screen.getByText('Rua Maior 1')).toBeInTheDocument()
    expect(screen.getByText('Location')).toBeInTheDocument()
    expect(screen.getByText('Lisbon')).toBeInTheDocument()
    expect(screen.getByText('Postal code')).toBeInTheDocument()
    expect(screen.getByText('1000-100')).toBeInTheDocument()
    expect(screen.getByText('Zone')).toBeInTheDocument()
    expect(screen.getByText('Sul')).toBeInTheDocument()

    // Classification section — Type resolves via tpClienteLabel (id 1 → Academia & Non-Profit).
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Academia & Non-Profit')).toBeInTheDocument()
    expect(screen.getByText('PHC no.')).toBeInTheDocument()
    expect(screen.getByText('7701')).toBeInTheDocument()
    expect(screen.getByText('Tax no.')).toBeInTheDocument()
    expect(screen.getByText('PT500123456')).toBeInTheDocument()
  })

  it('renders the not-found state when the client id does not exist', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, client: null }))

    renderWithProviders(<ClientDetailPage />, {
      initialPath: '/clients/99999',
      routePath: '/clients/:id',
    })

    expect(await screen.findByText('Client not found')).toBeInTheDocument()
    expect(screen.getByText('This client may have been removed.')).toBeInTheDocument()
  })

  it('renders the not-found state for an invalid (non-numeric) id without fetching', async () => {
    renderWithProviders(<ClientDetailPage />, {
      initialPath: '/clients/abc',
      routePath: '/clients/:id',
    })

    expect(await screen.findByText('Client not found')).toBeInTheDocument()
    expect(screen.getByText('The client identifier is invalid.')).toBeInTheDocument()
    // No fetch should fire — the query is disabled for a NaN id.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders a Back button on the not-found state', async () => {
    renderWithProviders(<ClientDetailPage />, {
      initialPath: '/clients/abc',
      routePath: '/clients/:id',
    })

    expect(await screen.findByRole('button', { name: /back/i })).toBeInTheDocument()
  })

  it('renders the error state when the endpoint fails', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(502, { ok: false, code: 'clients-not-configured', message: 'No clients profile.' }),
    )

    renderWithProviders(<ClientDetailPage />, {
      initialPath: '/clients/501',
      routePath: '/clients/:id',
    })

    expect(await screen.findByText(/Couldn't load client/)).toBeInTheDocument()
    expect(screen.getByText('No clients profile.')).toBeInTheDocument()
  })

  it('renders the loading state before the first fetch resolves', async () => {
    fetchMock.mockResolvedValueOnce(new Promise<Response>(() => {}))

    renderWithProviders(<ClientDetailPage />, {
      initialPath: '/clients/501',
      routePath: '/clients/:id',
    })

    expect(screen.getByText('Loading client…')).toBeInTheDocument()
  })
})