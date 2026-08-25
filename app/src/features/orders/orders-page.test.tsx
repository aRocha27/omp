import { describe, it, expect } from 'vitest'
import { screen, within, fireEvent } from '@testing-library/react'
import { OrdersPage } from '@/features/orders/orders-page'
import { renderWithProviders } from '@/test/render-with-providers'

describe('OrdersPage', () => {
  it('renders fixture rows ordered newest-first', async () => {
    renderWithProviders(<OrdersPage />, { initialPath: '/orders' })

    // The mock repository returns 7 deterministic summaries.
    expect(await screen.findByRole('table')).toBeInTheDocument()
    const rows = within(screen.getByRole('table')).getAllByRole('row')
    // 1 header row + 7 data rows
    expect(rows).toHaveLength(8)
  })

  it('sorts rows by a column header click (asc then desc)', async () => {
    renderWithProviders(<OrdersPage />, { initialPath: '/orders' })
    await screen.findByRole('table')

    const orderIds = () =>
      screen
        .getAllByRole('link', { name: /View order \d+ details/ })
        .map((link) => link.textContent?.trim())

    // Initial sort is Date desc (newest-first): 1007 (2025-10-10) first, then 1002 & 1001
    // share 2025-09-12 (1002 first), then 1003, 1004, 1005, 1006.
    expect(orderIds()).toEqual(['1007', '1002', '1001', '1003', '1004', '1005', '1006'])

    // Click the Client header to sort ascending. TanStack's default comparator sorts the
    // null client (1006) first, then the named clients A->Z; ties keep prior order (1001
    // before 1005; 1007 is the only "Maintenance Co").
    fireEvent.click(screen.getByRole('button', { name: /^Client, not sorted/ }))
    expect(orderIds()).toEqual(['1006', '1001', '1005', '1002', '1004', '1007', '1003'])

    // Click again -> descending: named clients Z->A, then the null client last; the two
    // "Client Alpha" rows keep their stable input order (1001 before 1005).
    fireEvent.click(screen.getByRole('button', { name: /^Client, sorted ascending/ }))
    expect(orderIds()).toEqual(['1003', '1007', '1004', '1002', '1001', '1005', '1006'])
  })

  it('shows the New order button for editors', async () => {
    renderWithProviders(<OrdersPage />, { initialPath: '/orders', initialRole: 'editor' })
    expect(await screen.findByRole('button', { name: /new order/i })).toBeVisible()
  })

  it('hides the New order button for viewers (UX gating only)', async () => {
    renderWithProviders(<OrdersPage />, { initialPath: '/orders', initialRole: 'viewer' })
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /new order/i })).not.toBeInTheDocument()
  })

  it('narrows results when filtering by client name', async () => {
    renderWithProviders(<OrdersPage />, { initialPath: '/orders' })
    // wait for initial load — all 6 rows present
    await screen.findByRole('table')

    const clientInput = screen.getByPlaceholderText('Search client')
    fireEvent.change(clientInput, { target: { value: 'Alpha' } })

    // Two fixtures share "Client Alpha" (1001, 1005); both remain, Beta is gone.
    const alphaRows = await screen.findAllByText('Client Alpha')
    expect(alphaRows).toHaveLength(2)
    expect(screen.queryByText('Client Beta')).not.toBeInTheDocument()
  })

  it('narrows results when filtering by PHC ref', async () => {
    renderWithProviders(<OrdersPage />, { initialPath: '/orders' })
    await screen.findByRole('table')

    const phcInput = screen.getByPlaceholderText('Search PHC ref')
    fireEvent.change(phcInput, { target: { value: '1001' } })

    // Contains, case-insensitive: '1001' matches 'PHC-1001' only.
    expect(await screen.findByText('PHC-1001')).toBeInTheDocument()
    expect(screen.queryByText('PHC-1002')).not.toBeInTheDocument()
  })

  it('links each row to its order detail and keeps the row mouse-clickable', async () => {
    renderWithProviders(<OrdersPage />, { initialPath: '/orders' })
    await screen.findByRole('table')

    // The Order # cell is a real link (keyboard-accessible) to the detail page.
    const link = screen.getByRole('link', { name: /View order 1001 details/ })
    expect(link).toHaveAttribute('href', '/orders/1001')

    // The whole row stays mouse-clickable (cursor affordance, no error on click).
    const row = link.closest('tr') as HTMLElement
    expect(row.className).toContain('cursor-pointer')
    expect(() => fireEvent.click(row)).not.toThrow()
  })

  it('narrows results when filtering by the Order type checkboxes', async () => {
    renderWithProviders(<OrdersPage />, { initialPath: '/orders' })
    await screen.findByRole('table')

    // Each checkbox filter is a button that opens a dropdown. Open the Order type dropdown.
    fireEvent.click(screen.getByRole('button', { name: 'Order type' }))
    // COM's checkbox is labelled "Comercial".
    fireEvent.click(screen.getByRole('checkbox', { name: 'Comercial' }))

    // COM orders are 1002 (Client Beta) and 1003 (Test Dealer); C orders gone.
    expect(await screen.findByText('Client Beta')).toBeInTheDocument()
    expect(screen.queryByText('Client Alpha')).not.toBeInTheDocument()
    expect(screen.queryByText('Demo Hospital')).not.toBeInTheDocument()
  })

  it('narrows results when filtering by the Area checkboxes', async () => {
    renderWithProviders(<OrdersPage />, { initialPath: '/orders' })
    await screen.findByRole('table')

    // Open the Area dropdown, then tick the BOPT checkbox.
    fireEvent.click(screen.getByRole('button', { name: 'Area' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'BOPT' }))

    // BOPT orders are 1003 (Test Dealer) and 1004 (Demo Hospital).
    expect(await screen.findByText('Test Dealer')).toBeInTheDocument()
    expect(screen.queryByText('Client Beta')).not.toBeInTheDocument()
  })

  it('exposes filter controls with accessible names for screen readers', async () => {
    renderWithProviders(<OrdersPage />, { initialPath: '/orders' })
    await screen.findByRole('table')

    // Each checkbox filter is a button with aria-haspopup; opening it reveals a labelled
    // group of checkboxes.
    const areaButton = screen.getByRole('button', { name: 'Area' })
    expect(areaButton).toHaveAttribute('aria-haspopup', 'true')
    fireEvent.click(areaButton)
    expect(screen.getByRole('group', { name: 'Area' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'BOPT' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Order type' }))
    expect(screen.getByRole('checkbox', { name: 'Comercial' })).toBeInTheDocument()
    // Text filters remain <input> associated by label.
    expect(screen.getByPlaceholderText('Search client').tagName).toBe('INPUT')
    expect(screen.getByPlaceholderText('Search PHC ref').tagName).toBe('INPUT')
  })
})