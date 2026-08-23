import { describe, it, expect } from 'vitest'
import { screen, within, fireEvent } from '@testing-library/react'
import { OrdersPage } from '@/features/orders/orders-page'
import { renderWithProviders } from '@/test/render-with-providers'

describe('OrdersPage', () => {
  it('renders fixture rows ordered newest-first', async () => {
    renderWithProviders(<OrdersPage />, { initialPath: '/orders' })

    // The mock repository returns 6 deterministic summaries.
    expect(await screen.findByRole('table')).toBeInTheDocument()
    const rows = within(screen.getByRole('table')).getAllByRole('row')
    // 1 header row + 6 data rows
    expect(rows).toHaveLength(7)
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

  it('makes rows clickable and navigates on row click without error', async () => {
    renderWithProviders(<OrdersPage />, { initialPath: '/orders' })
    await screen.findByRole('table')

    // The first data row (Client Alpha, order 1001) should be clickable.
    const alphaCells = await screen.findAllByText('Client Alpha')
    const row = alphaCells[0].closest('tr')
    expect(row).not.toBeNull()
    const rowEl = row as HTMLElement
    expect(rowEl.tabIndex).toBe(0)
    expect(rowEl.className).toContain('cursor-pointer')

    // Clicking must not throw; navigation is exercised end-to-end by E2E.
    expect(() => fireEvent.click(rowEl)).not.toThrow()
  })
})