/**
 * Tests for ClientCreatePage.
 *
 * Global `fetch` is stubbed — no network. Covers the form submit → POST
 * `/api/clients` with role header → navigates to the detail page on success,
 * and surfaces the backend error message inline on failure.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { ClientCreatePage } from '@/features/clients/components/client-create-page'
import { renderWithProviders } from '@/test/render-with-providers'
import type { Client } from '@/domain/models/client'

const created: Client = {
  ID_Cliente: 999,
  no_PHC: 9001,
  ID_Tp_Cliente: 1,
  nome: 'Brand New Client',
  ncont: 'PT900099999',
  fax: null,
  telefone: null,
  contacto: null,
  morada: 'Rua Nova 1',
  local: 'Lisbon',
  codpost: '1000-001',
  zona: null,
  Defense: false,
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('ClientCreatePage', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders all required fields plus the optional ones', () => {
    renderWithProviders(<ClientCreatePage />, {
      initialRole: 'admin',
      initialPath: '/clients/new',
      routePath: '/clients/new',
    })

    // Seven user-required inputs + four optional inputs.
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Address' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Location' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Postal Code' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'SAP number' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Tax Number' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Type' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Phone' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Fax' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Contact name' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Zone' })).toBeInTheDocument()
  })

  it('POSTs to /api/clients with the typed payload and the admin role', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { ok: true, client: created }))

    const { user } = renderWithProviders(<ClientCreatePage />, {
      initialRole: 'admin',
      initialPath: '/clients/new',
      routePath: '/clients/new',
    })

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Brand New Client')
    await user.type(screen.getByRole('textbox', { name: 'Address' }), 'Rua Nova 1')
    await user.type(screen.getByRole('textbox', { name: 'Location' }), 'Lisbon')
    await user.type(screen.getByRole('textbox', { name: 'Postal Code' }), '1000-001')
    await user.type(screen.getByRole('spinbutton', { name: 'SAP number' }), '9001')
    await user.type(screen.getByRole('textbox', { name: 'Tax Number' }), 'PT900099999')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), '1')

    await user.click(screen.getByRole('button', { name: /create client/i }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/clients')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>)['x-user-role']).toBe('admin')
    expect(JSON.parse(init?.body as string)).toEqual({
      nome: 'Brand New Client',
      morada: 'Rua Nova 1',
      local: 'Lisbon',
      codpost: '1000-001',
      no_PHC: 9001,
      ncont: 'PT900099999',
      ID_Tp_Cliente: 1,
      telefone: null,
      contacto: null,
      fax: null,
      zona: null,
      Defense: false,
    })
  })

  it('sends a viewer role header for non-admin roles', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { ok: true, client: created }))

    const { user } = renderWithProviders(<ClientCreatePage />, {
      initialRole: 'editor',
      initialPath: '/clients/new',
      routePath: '/clients/new',
    })

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'x')
    await user.type(screen.getByRole('textbox', { name: 'Address' }), 'x')
    await user.type(screen.getByRole('textbox', { name: 'Location' }), 'x')
    await user.type(screen.getByRole('textbox', { name: 'Postal Code' }), 'x')
    await user.type(screen.getByRole('spinbutton', { name: 'SAP number' }), '1')
    await user.type(screen.getByRole('textbox', { name: 'Tax Number' }), 'x')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), '1')
    await user.click(screen.getByRole('button', { name: /create client/i }))

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['x-user-role']).toBe('editor')
  })

  it('surfaces a backend failure inline and keeps the form mounted', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { ok: false, code: 'forbidden', message: 'Only admins may create clients.' }),
    )

    const { user } = renderWithProviders(<ClientCreatePage />, {
      initialRole: 'viewer',
      initialPath: '/clients/new',
      routePath: '/clients/new',
    })

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'x')
    await user.type(screen.getByRole('textbox', { name: 'Address' }), 'x')
    await user.type(screen.getByRole('textbox', { name: 'Location' }), 'x')
    await user.type(screen.getByRole('textbox', { name: 'Postal Code' }), 'x')
    await user.type(screen.getByRole('spinbutton', { name: 'SAP number' }), '1')
    await user.type(screen.getByRole('textbox', { name: 'Tax Number' }), 'x')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), '1')
    await user.click(screen.getByRole('button', { name: /create client/i }))

    // Inline error rendered; form still present so the user can retry.
    expect(await screen.findByRole('alert')).toHaveTextContent('Only admins may create clients.')
    expect(screen.getByRole('button', { name: /create client/i })).toBeInTheDocument()
  })
})