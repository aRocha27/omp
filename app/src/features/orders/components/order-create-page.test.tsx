/**
 * Tests for the Order create page.
 *
 * The clients read path is HTTP-only (no mock repository) in every mode, so global `fetch` is
 * stubbed to serve `/api/clients/list`. The orders create path runs through the mock repository
 * in test mode, so `@/services` is wrapped to spy on `orders.create` and assert the submitted
 * input. The tests verify: the combobox limits the client to the list (no free entry), the
 * revenue type select is required, saving without a picked client surfaces a visible error
 * instead of silently no-op'ing, and a successful save forwards the picked client id and revenue
 * type to the repository.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import { OrderCreatePage } from '@/features/orders/components/order-create-page'
import { renderWithProviders } from '@/test/render-with-providers'
import type { OrderCreateInput } from '@/services/contracts/orders.repository'
import type { Order } from '@/domain/models/order'
import type * as Services from '@/services'

// Captures the input handed to `orders.create` so the test can assert the picked client id and
// revenue type are forwarded (the mock repository would otherwise accept anything silently).
let createInput: OrderCreateInput | undefined
const createSpy = vi.fn(async (input: OrderCreateInput): Promise<Order> => {
  createInput = input
  return {
    ID_Order: 1008,
    DT_Order: input.DT_Order ?? '2026-08-25T00:00:00.000Z',
    Order_Factory: false,
    ID_Tp_Order: input.ID_Tp_Order ?? 'C',
    Provisoria: false,
    Encomenda_Cli_PHC: input.Encomenda_Cli_PHC ?? null,
    ID_Client: input.ID_Client ?? null,
    Client_Name: 'Client Alpha',
    ID_Area: input.ID_Area ?? null,
    ID_Tipo: input.ID_Tipo ?? null,
    Tipo_Warranty: false,
    ID_Produto: input.ID_Produto ?? null,
    ID_Instrumento: input.ID_Instrumento ?? null,
    Orc_Proposta: null,
    PO_Cliente: null,
    Sell_Price: input.Sell_Price ?? null,
    ID_Tp_Warranty: null,
    Warranty_Reserve: null,
    Warranty_DT_Inicio: null,
    ID_Tp_Revenue: input.ID_Tp_Revenue ?? null,
    Facturado: false,
    Reconhecido: false,
    Cod_Enc_Fornecedor: null,
    Obs: null,
    Negocio_Fechado: false,
    ID_User: null,
    DT_User: null,
    upsize_ts: null,
    Kit: input.Kit ?? false,
    Kit_Amount: input.Kit_Amount ?? null,
    Contacto: null,
    Email: null,
  }
})

vi.mock('@/services', async (importActual) => {
  const actual = (await importActual()) as typeof Services
  return {
    ...actual,
    createRepositories: () => ({
      ...actual.createRepositories(),
      orders: { ...actual.createRepositories().orders, create: createSpy },
    }),
  }
})

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

const clientsPayload = {
  ok: true,
  clients: [
    {
      ID_Cliente: 501,
      no_PHC: 7701,
      ID_Tp_Cliente: 1,
      nome: 'Client Alpha',
      ncont: 'PT500123456',
      telefone: '+351210000000',
      local: 'Lisbon',
    },
    {
      ID_Cliente: 502,
      no_PHC: 7702,
      ID_Tp_Cliente: 1,
      nome: 'Client Beta',
      ncont: 'PT500654321',
      telefone: '+351210000111',
      local: 'Porto',
    },
  ],
}

describe('OrderCreatePage', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createInput = undefined
    createSpy.mockClear()
    // Clients read path is HTTP-only; stub fetch to serve `/api/clients/list`. The orders create
    // path is spied via the `@/services` mock above, so it never reaches fetch.
    fetchMock = vi.fn(async (url: string | URL, init: RequestInit = {}) => {
      const path = String(url)
      const method = init.method ?? 'GET'
      if (path.endsWith('/api/clients/list') && method === 'POST') {
        return jsonResponse(200, clientsPayload)
      }
      return jsonResponse(404, { ok: false, code: 'not-found', message: 'unknown endpoint' })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('marks all mandatory order fields as required', async () => {
    renderWithProviders(<OrderCreatePage />, { initialPath: '/orders/new', initialRole: 'editor' })
    for (const label of [
      'Order date',
      'Order type',
      'Client',
      'SAP Order Number',
      'Revenue Type',
      'Area',
      'Product type',
      'Product',
      'Instrument',
      'Sell Price',
    ]) {
      expect(await screen.findByLabelText(label)).toBeRequired()
    }
  })

  it('requires only order type and Client for a non-Client order', async () => {
    renderWithProviders(<OrderCreatePage />, { initialPath: '/orders/new', initialRole: 'editor' })
    fireEvent.change(await screen.findByLabelText('Order type'), { target: { value: 'WPO' } })

    expect(screen.getByLabelText('Order type')).toBeRequired()
    expect(screen.getByLabelText('Client')).toBeRequired()
    expect(screen.getByLabelText('SAP Order Number')).toBeRequired()
    for (const label of [
      'Order date',
      'Revenue Type',
      'Area',
      'Product type',
      'Product',
      'Instrument',
      'Sell Price',
    ]) {
      expect(screen.getByLabelText(label)).not.toBeRequired()
    }
  })

  it('reveals Kit Amount and read-only Balance when Kit is selected', async () => {
    renderWithProviders(<OrderCreatePage />, { initialPath: '/orders/new', initialRole: 'editor' })

    const kit = await screen.findByRole('checkbox', { name: 'Kit' })
    expect(kit).not.toBeChecked()
    expect(screen.queryByLabelText('Kit Amount')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Balance')).not.toBeInTheDocument()

    fireEvent.click(kit)
    const kitAmount = screen.getByLabelText('Kit Amount')
    const saldo = screen.getByLabelText('Balance')
    expect(kitAmount).toHaveAttribute('type', 'number')
    expect(saldo).toHaveAttribute('readonly')

    fireEvent.change(kitAmount, { target: { value: '1500' } })
    expect(saldo).toHaveValue(1500)
  })

  it('lists clients filtered by the search text in a single combobox', async () => {
    renderWithProviders(<OrderCreatePage />, { initialPath: '/orders/new', initialRole: 'editor' })
    const search = await screen.findByPlaceholderText('Search clients...')
    fireEvent.change(search, { target: { value: 'Alpha' } })

    // The combobox offers matches from the clients list (no separate Select anymore).
    expect(await screen.findByRole('option', { name: /Client Alpha/ })).toBeInTheDocument()
  })

  // Fill every native-required select so the form's HTML5 validation passes and the submit
  // event reaches the JS handler — the client combobox has no `required` attribute, so the
  // "no client picked" case is enforced in JS, not by the browser. The Área/Produto selects are
  // backed by the async reference hooks, so each pick waits for its option to render before
  // changing — setting a value whose <option> isn't present yet is silently dropped by the
  // browser. Produto '5' (LAB GC / SQ-MS Service) belongs to área BDAL, matching the cascade.
  async function selectOption(label: string, value: string) {
    const select = await screen.findByLabelText(label)
    await waitFor(() => {
      const opts = within(select).getAllByRole('option')
      expect(opts.some((o) => (o as HTMLOptionElement).value === value)).toBe(true)
    })
    fireEvent.change(select, { target: { value } })
  }

  async function fillRequiredSelects() {
    fireEvent.change(screen.getByLabelText('SAP Order Number'), { target: { value: 'SAP-9100' } })
    await selectOption('Area', 'BDAL')
    await selectOption('Product type', 'INSTR')
    await selectOption('Product', '5')
    await selectOption('Instrument', '4')
    await selectOption('Revenue Type', '1')
    fireEvent.change(screen.getByLabelText('Sell Price'), { target: { value: '12500' } })
  }

  async function pickClient(name = 'Alpha') {
    const search = await screen.findByPlaceholderText('Search clients...')
    fireEvent.change(search, { target: { value: name } })
    const option = await screen.findByRole('option', { name: new RegExp(`Client ${name}`) })
    fireEvent.click(within(option).getByRole('button'))
  }

  it('shows a visible error and does not call create when saving without picking a client', async () => {
    renderWithProviders(<OrderCreatePage />, { initialPath: '/orders/new', initialRole: 'editor' })
    const search = await screen.findByPlaceholderText('Search clients...')
    // Type a search but never pick a result — free text must not be accepted as a client id.
    fireEvent.change(search, { target: { value: 'Alpha' } })
    await screen.findByRole('option', { name: /Client Alpha/ })
    await fillRequiredSelects()

    fireEvent.click(screen.getByRole('button', { name: /Create order/ }))

    expect(await screen.findByText('Select a client from the list.')).toBeInTheDocument()
    // The create repository is never reached without a selected client.
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('creates the order after a client is picked from the list', async () => {
    renderWithProviders(<OrderCreatePage />, { initialPath: '/orders/new', initialRole: 'editor' })
    await fillRequiredSelects()
    await pickClient()

    fireEvent.click(screen.getByRole('button', { name: /Create order/ }))

    // The create repository is called with the picked client id (a number, not the typed text)
    // and the required revenue type. The cascaded área/produto are forwarded too.
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1))
    expect(createInput?.ID_Client).toBe(501)
    expect(createInput?.Encomenda_Cli_PHC).toBe('SAP-9100')
    expect(createInput?.ID_Tp_Revenue).toBe(1)
    expect(createInput?.ID_Area).toBe('BDAL')
    expect(createInput?.ID_Produto).toBe(5)
    expect(createInput?.ID_Instrumento).toBe(4)
    expect(createInput?.Sell_Price).toBe(12500)
    expect(createInput?.Kit).toBe(false)
    expect(createInput?.Kit_Amount).toBeNull()
  })

  it('submits Kit and Kit Amount as typed values without persisting Balance', async () => {
    renderWithProviders(<OrderCreatePage />, { initialPath: '/orders/new', initialRole: 'editor' })
    await fillRequiredSelects()
    await pickClient()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Kit' }))
    fireEvent.change(screen.getByLabelText('Kit Amount'), { target: { value: '1500.25' } })
    fireEvent.click(screen.getByRole('button', { name: /Create order/ }))

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1))
    expect(createInput?.Kit).toBe(true)
    expect(createInput?.Kit_Amount).toBe(1500.25)
    expect(createInput).not.toHaveProperty('Balance')
  })

  it('clears a hidden Kit Amount when Kit is deselected before submit', async () => {
    renderWithProviders(<OrderCreatePage />, { initialPath: '/orders/new', initialRole: 'editor' })
    await fillRequiredSelects()
    await pickClient()

    const kit = screen.getByRole('checkbox', { name: 'Kit' })
    fireEvent.click(kit)
    fireEvent.change(screen.getByLabelText('Kit Amount'), { target: { value: '999' } })
    fireEvent.click(kit)
    expect(screen.queryByLabelText('Kit Amount')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Balance')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Create order/ }))
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1))
    expect(createInput?.Kit).toBe(false)
    expect(createInput?.Kit_Amount).toBeNull()
  })

  it('cascades Área → Produto and resets the child when the parent changes', async () => {
    renderWithProviders(<OrderCreatePage />, { initialPath: '/orders/new', initialRole: 'editor' })
    await selectOption('Area', 'BDAL')
    // BDAL produtos are 5–11; BOPT produtos (1,2,3,12,13) must NOT appear.
    const produtoSelect = await screen.findByLabelText('Product')
    await waitFor(() => {
      const opts = within(produtoSelect).getAllByRole('option')
      expect(opts.some((o) => (o as HTMLOptionElement).value === '5')).toBe(true)
      expect(opts.some((o) => (o as HTMLOptionElement).value === '1')).toBe(false)
    })
    await selectOption('Product', '5')

    // Switching área to BOPT resets the picked produto and re-filters the dropdown.
    await selectOption('Area', 'BOPT')
    await waitFor(() => {
      const opts = within(produtoSelect).getAllByRole('option')
      const placeholder = opts.find((o) => (o as HTMLOptionElement).value === '')
      expect((placeholder as HTMLOptionElement)?.selected).toBe(true)
      expect(opts.some((o) => (o as HTMLOptionElement).value === '1')).toBe(true)
      expect(opts.some((o) => (o as HTMLOptionElement).value === '5')).toBe(false)
    })
  })
})
