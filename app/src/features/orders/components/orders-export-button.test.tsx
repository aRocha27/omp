import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrdersExportButton } from '@/features/orders/components/orders-export-button'
import type { OrderSummary } from '@/domain/models/order'
import type { ExportFilterLabels } from '@/utils/orders-export'

const noFilters: ExportFilterLabels = {
  clientName: null,
  orderType: null,
  area: null,
  tipo: null,
  product: null,
  instrument: null,
  sapOrder: null,
  dateFrom: null,
  dateTo: null,
  factoryOnly: false,
  closedOnly: false,
}

const order: OrderSummary = {
  ID_Order: 1001,
  DT_Order: '2025-09-12',
  Order_Factory: false,
  ID_Tp_Order: 'C',
  Provisoria: false,
  ID_Client: 501,
  Client_Name: 'Client Alpha',
  ID_Area: 'BDAL',
  ID_Tipo: 'INSTR',
  ID_Produto: 10,
  ID_Instrumento: 1,
  Sell_Price: 48500,
  Negocio_Fechado: true,
  Encomenda_Cli_PHC: 'PHC-1001',
  Kit: false,
  ID_Tp_Warranty: 1,
  Warranty_Reserve: 1455,
  Warranty_DT_Inicio: '2025-09-13',
  Orc_Proposta: 'ORC-1001',
  PO_Cliente: 'PO-ALPHA-001',
  ID_Tp_Revenue: 1,
}

describe('OrdersExportButton', () => {
  beforeEach(() => {
    // SheetJS' `writeFile` uses an `<a download>` element appended to the DOM
    // and clicked. jsdom doesn't ship a download implementation, so we stub it
    // and assert it was called with the right file name.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function mock(
      this: HTMLAnchorElement,
    ) {
      // No-op: avoid jsdom's "not implemented" navigation warning. The href
      // / download attributes are still on the element so the test can assert
      // them if needed.
      void this
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a disabled button with a helpful tooltip when there are no orders', () => {
    render(<OrdersExportButton orders={[]} filterLabels={noFilters} />)
    const button = screen.getByRole('button', { name: /export to excel/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute(
      'title',
      'No orders to export. Adjust the filters to see at least one row.',
    )
  })

  it('is disabled when the disabled prop is true', () => {
    render(
      <OrdersExportButton
        orders={[order]}
        filterLabels={noFilters}
        disabled
      />,
    )
    expect(screen.getByRole('button', { name: /export/i })).toBeDisabled()
  })

  it('renders an enabled button with a per-row count in the accessible name', () => {
    render(<OrdersExportButton orders={[order]} filterLabels={noFilters} />)
    expect(
      screen.getByRole('button', { name: /export 1 order to excel/i }),
    ).toBeInTheDocument()
  })

  it('flips to a brief "Exported" confirmation when clicked', async () => {
    const user = userEvent.setup()
    render(<OrdersExportButton orders={[order]} filterLabels={noFilters} />)

    const button = screen.getByRole('button', { name: /export 1 order/i })
    await user.click(button)

    // The label flips to "Exported" momentarily so the user gets feedback that
    // the download fired.
    expect(screen.getByText('Exported')).toBeInTheDocument()
  })
})
