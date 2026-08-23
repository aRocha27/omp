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
})