import { describe, it, expect } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { OrderDetailPage } from '@/features/orders/components/order-detail-page'
import { renderWithProviders } from '@/test/render-with-providers'

describe('OrderDetailPage', () => {
  it('renders the order heading and resolved client name for a found order', async () => {
    renderWithProviders(<OrderDetailPage />, {
      initialPath: '/orders/1001',
      routePath: '/orders/:id',
    })

    // The heading uses the client name (the DB id ID_Order is not user-facing).
    const heading = await screen.findByRole('heading', { name: /Client Alpha/ })
    expect(heading).toBeInTheDocument()

    // Overview is the default tab; it surfaces the sell price.
    expect(screen.getByText('€48,500.00')).toBeInTheDocument()
    expect(screen.getByText('Sell Price')).toBeInTheDocument()
  })

  it('renders five tabs with the Overview tab active by default', async () => {
    renderWithProviders(<OrderDetailPage />, {
      initialPath: '/orders/1001',
      routePath: '/orders/:id',
    })

    const tablist = await screen.findByRole('tablist', { name: 'Order details' })
    expect(tablist).toBeInTheDocument()

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(5)
    expect(tabs[0]).toHaveTextContent('Overview')
    expect(tabs[1]).toHaveTextContent('Client & Contact')
    expect(tabs[2]).toHaveTextContent('References')
    expect(tabs[3]).toHaveTextContent('Financial')
    expect(tabs[4]).toHaveTextContent('Notes & Audit')

    // Overview is selected and in the tab order; the others are not.
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveAttribute('tabindex', '0')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
    expect(tabs[1]).toHaveAttribute('tabindex', '-1')
  })

  it('switches panels when a tab is clicked', async () => {
    renderWithProviders(<OrderDetailPage />, {
      initialPath: '/orders/1001',
      routePath: '/orders/:id',
    })

    await screen.findByRole('heading', { name: /Client Alpha/ })
    expect(screen.queryByText('Quoted Price')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Financial' }))
    expect(screen.getByText('Quoted Price')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Financial' })).toHaveAttribute('aria-selected', 'true')

    // "Last User" lives only on the Notes & Audit tab.
    expect(screen.queryByText('Last User')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Notes & Audit' }))
    expect(screen.getByText('Last User')).toBeInTheDocument()
  })

  it('renders the not-found state when the order id does not exist', async () => {
    renderWithProviders(<OrderDetailPage />, {
      initialPath: '/orders/99999',
      routePath: '/orders/:id',
    })

    // No fixture has id 99999, so the repository resolves to null.
    expect(await screen.findByText('Order not found')).toBeInTheDocument()
    expect(screen.getByText('This order may have been removed.')).toBeInTheDocument()
  })

  it('renders the not-found state for an invalid (non-numeric) id', async () => {
    renderWithProviders(<OrderDetailPage />, {
      initialPath: '/orders/abc',
      routePath: '/orders/:id',
    })

    // NaN guard short-circuits before the query fires.
    expect(await screen.findByText('Order not found')).toBeInTheDocument()
    expect(screen.getByText('The order identifier is invalid.')).toBeInTheDocument()
  })

  it('renders a Back to orders button on the not-found state', async () => {
    renderWithProviders(<OrderDetailPage />, {
      initialPath: '/orders/abc',
      routePath: '/orders/:id',
    })

    expect(await screen.findByRole('button', { name: /back to orders/i })).toBeInTheDocument()
  })
})