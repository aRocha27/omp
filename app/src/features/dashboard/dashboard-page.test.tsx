import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { renderWithProviders } from '@/test/render-with-providers'
import { MockDashboardRepository } from '@/services/mock/dashboard.mock-repository'
import type { DashboardSnapshot } from '@/domain/models/dashboard'
import type { OrderSummary } from '@/domain/models/order'

const recentOrder: OrderSummary = {
  ID_Order: 501,
  DT_Order: '2026-08-23T00:00:00.000Z',
  Order_Factory: false,
  ID_Tp_Order: 'C',
  Provisoria: false,
  ID_Client: 93,
  Client_Name: 'ITQB Noval',
  ID_Area: 'BDAL',
  ID_Tipo: 'INSTR',
  ID_Produto: 2,
  ID_Instrumento: 1,
  Sell_Price: 12500,
  Negocio_Fechado: true,
  Encomenda_Cli_PHC: 'PHC-001',
  Kit: false,
  ID_Tp_Warranty: 2,
  Warranty_Reserve: 500,
  Warranty_DT_Inicio: '2026-01-01T00:00:00.000Z',
  Orc_Proposta: 'PROP-12000',
  PO_Cliente: 'PO-1',
  ID_Tp_Revenue: 1,
}

const snapshot: DashboardSnapshot = {
  year: 2026,
  kpis: {
    ordersBookedYtd: 8,
    nobYtd: 125000,
    revenueRecognizedYtd: 82000,
    backlogToRecognize: 43000,
    backlogAtPeriodStart: 51000,
  },
  monthlyTrend: [
    { monthStart: '2026-01-01T00:00:00.000Z', revenue: 1000, nob: 2000 },
    { monthStart: '2026-02-01T00:00:00.000Z', revenue: 0, nob: 1500 },
  ],
  recognitionQueue: [
    {
      idOrder: 1001,
      encPhc: '5052310',
      orderDate: '2026-08-25T00:00:00.000Z',
      client: 'Client Alpha',
      area: 'BDAL',
      product: 'ESI TOF',
      type: 'INSTRUMENT',
      sellPrice: 18500,
      recognizedValue: 11562,
      remainingValue: 6938,
      invoiced: false,
    },
  ],
  recentOrders: [recentOrder],
}

describe('DashboardPage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders the loading state before the snapshot resolves', () => {
    vi.spyOn(MockDashboardRepository.prototype, 'getSnapshot').mockImplementationOnce(
      () => new Promise(() => {}),
    )

    renderWithProviders(<DashboardPage />, { initialPath: '/', routePath: '/' })

    expect(screen.getByText('Loading dashboard…')).toBeInTheDocument()
  })

  it('renders the error state when the snapshot query fails', async () => {
    vi.spyOn(MockDashboardRepository.prototype, 'getSnapshot').mockRejectedValueOnce(
      new Error('Dashboard unavailable.'),
    )

    renderWithProviders(<DashboardPage />, { initialPath: '/', routePath: '/' })

    expect(await screen.findByText(/Couldn’t load dashboard/)).toBeInTheDocument()
    expect(screen.getByText('Dashboard unavailable.')).toBeInTheDocument()
  })

  it('renders the KPI cards, trend, recognition queue, and recent orders', async () => {
    vi.spyOn(MockDashboardRepository.prototype, 'getSnapshot').mockResolvedValueOnce(snapshot)

    renderWithProviders(<DashboardPage />, {
      initialPath: '/',
      routePath: '/',
      initialRole: 'editor',
    })

    expect(await screen.findByText('Orders booked YTD')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('NOB YTD')).toBeInTheDocument()
    expect(screen.getByText('Revenue recognized YTD')).toBeInTheDocument()
    expect(screen.getByText('Backlog to recognize')).toBeInTheDocument()
    expect(screen.getByText('Backlog at period start')).toBeInTheDocument()

    expect(screen.getByText('Monthly operational trend')).toBeInTheDocument()
    expect(screen.getAllByText('Revenue').length).toBeGreaterThan(0)
    expect(screen.getAllByText('NOB').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Jan\. Revenue/i })).toBeInTheDocument()

    expect(screen.getByText('To recognize')).toBeInTheDocument()
    expect(screen.getByText('Client Alpha')).toBeInTheDocument()
    expect(screen.getByText('€6,938.00')).toBeInTheDocument()

    expect(screen.getByText('Recent orders')).toBeInTheDocument()
    const orderLink = screen.getByRole('link', { name: '501' })
    expect(orderLink).toHaveAttribute('href', '/orders/501')
    expect(screen.getByText('ITQB Noval')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new order/i })).toBeInTheDocument()
  })

  it('opens the recognition backlog modal from the "To recognize" card and links rows to the order', async () => {
    const user = userEvent.setup()
    vi.spyOn(MockDashboardRepository.prototype, 'getSnapshot').mockResolvedValueOnce(snapshot)
    vi.spyOn(MockDashboardRepository.prototype, 'getRecognitionQueue').mockResolvedValueOnce(
      snapshot.recognitionQueue,
    )

    renderWithProviders(<DashboardPage />, {
      initialPath: '/',
      routePath: '/',
      initialRole: 'editor',
    })

    expect(await screen.findByText('To recognize')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: /full backlog/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /view all/i }))

    const dialog = await screen.findByRole('dialog', { name: /full backlog/i })
    expect(dialog).toBeInTheDocument()
    const orderLink = await within(dialog).findByRole('link', { name: /view order 1001/i })
    expect(orderLink).toHaveAttribute('href', '/orders/1001')
  })

  it('hides the New order action for viewer role', async () => {
    vi.spyOn(MockDashboardRepository.prototype, 'getSnapshot').mockResolvedValueOnce(snapshot)

    renderWithProviders(<DashboardPage />, {
      initialPath: '/',
      routePath: '/',
      initialRole: 'viewer',
    })

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new order/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open orders/i })).toBeInTheDocument()
  })
})
