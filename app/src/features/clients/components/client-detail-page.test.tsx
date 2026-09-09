/**
 * Tests for ClientDetailPage.
 *
 * Global `fetch` is stubbed — no network. Mirrors `order-detail-page.test.tsx`:
 * covers the found-detail render (heading + classification/contact/address
 * fields), the not-found state for a missing id, the not-found state for an
 * invalid non-numeric id, and the loading state. Also covers the ADMIN-only
 * inline-edit toggle: the button is hidden for editor/viewer, opens the form
 * when clicked by an admin, and pre-fills the form from the loaded client.
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
    expect(screen.getByText('SAP no.')).toBeInTheDocument()
    expect(screen.getByText('7701')).toBeInTheDocument()
    expect(screen.getByText('Tax no.')).toBeInTheDocument()
    expect(screen.getByText('PT500123456')).toBeInTheDocument()
    expect(screen.getByText('Defense')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
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

  it('hides the Edit button for non-admin users (editor role)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, client: detailRow }))

    renderWithProviders(<ClientDetailPage />, {
      initialRole: 'editor',
      initialPath: '/clients/501',
      routePath: '/clients/:id',
    })

    expect(await screen.findByRole('heading', { name: /Client Alpha/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('hides the Edit button for non-admin users (viewer role)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, client: detailRow }))

    renderWithProviders(<ClientDetailPage />, {
      initialRole: 'viewer',
      initialPath: '/clients/501',
      routePath: '/clients/:id',
    })

    expect(await screen.findByRole('heading', { name: /Client Alpha/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('shows the Edit button for admins and opens a pre-filled form on click', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, client: detailRow }))

    const { user } = renderWithProviders(<ClientDetailPage />, {
      initialRole: 'admin',
      initialPath: '/clients/501',
      routePath: '/clients/:id',
    })

    const editButton = await screen.findByRole('button', { name: /edit/i })
    await user.click(editButton)

    // Edit mode swaps the read view for the form. The read-only "Type" label
    // would have matched via the heading; the form label is `Type *`.
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Client Alpha')
    expect(screen.getByRole('textbox', { name: 'Address' })).toHaveValue('Rua Maior 1')
    expect(screen.getByRole('textbox', { name: 'Location' })).toHaveValue('Lisbon')
    expect(screen.getByRole('textbox', { name: 'Postal Code' })).toHaveValue('1000-100')
    expect(screen.getByRole('spinbutton', { name: 'SAP number' })).toHaveValue(7701)
    expect(screen.getByRole('textbox', { name: 'Tax Number' })).toHaveValue('PT500123456')
    expect(screen.getByRole('combobox', { name: 'Type' })).toHaveValue('1')
    expect(screen.getByRole('textbox', { name: 'Phone' })).toHaveValue('+351210000000')
    expect(screen.getByRole('textbox', { name: 'Fax' })).toHaveValue('+351210000001')
    expect(screen.getByRole('textbox', { name: 'Contact name' })).toHaveValue('Jane Doe')
    expect(screen.getByRole('textbox', { name: 'Zone' })).toHaveValue('Sul')

    // Save/Cancel are exposed while in edit mode.
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })

  it('cancel returns to the read view without issuing an update request', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, client: detailRow }))

    const { user } = renderWithProviders(<ClientDetailPage />, {
      initialRole: 'admin',
      initialPath: '/clients/501',
      routePath: '/clients/:id',
    })

    await user.click(await screen.findByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    // Read view returns, form is gone, Edit button returns for re-entry.
    expect(screen.getByText('Street address')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1) // only the GET, no PATCH
  })

  it('save issues the patch and returns to the read view on success', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { ok: true, client: detailRow }))
      .mockResolvedValueOnce(
        jsonResponse(200, { ok: true, client: { ...detailRow, nome: 'Client Alpha v2' } }),
      )

    const { user } = renderWithProviders(<ClientDetailPage />, {
      initialRole: 'admin',
      initialPath: '/clients/501',
      routePath: '/clients/:id',
    })

    await user.click(await screen.findByRole('button', { name: /edit/i }))
    const nameInput = screen.getByRole('textbox', { name: 'Name' })
    await user.clear(nameInput)
    await user.type(nameInput, 'Client Alpha v2')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    // Returned to read view (Edit button is back).
    expect(await screen.findByRole('button', { name: /edit/i })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, updateInit] = fetchMock.mock.calls[1]
    expect(updateInit?.method).toBe('POST')
    expect((updateInit?.headers as Record<string, string>)['x-user-role']).toBe('admin')
    expect(JSON.parse(updateInit?.body as string)).toEqual({
      id: 501,
      patch: { nome: 'Client Alpha v2' },
    })
  })

  it('skips the update call when nothing changed and just exits edit mode', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, client: detailRow }))

    const { user } = renderWithProviders(<ClientDetailPage />, {
      initialRole: 'admin',
      initialPath: '/clients/501',
      routePath: '/clients/:id',
    })

    await user.click(await screen.findByRole('button', { name: /edit/i }))
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    // No patch was needed — the form short-circuits and the read view returns.
    expect(await screen.findByRole('button', { name: /edit/i })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})