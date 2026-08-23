import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { OrderDetailPage } from '@/features/orders/components/order-detail-page'
import { renderWithProviders } from '@/test/render-with-providers'

describe('OrderDetailPage', () => {
  it('renders the order heading and resolved client name for a found order', async () => {
    renderWithProviders(<OrderDetailPage />, {
      initialPath: '/orders/1001',
      routePath: '/orders/:id',
    })

    // Heading implicitly waits for the async fetch to resolve.
    const heading = await screen.findByRole('heading', { name: /Order #1001/ })
    expect(heading).toBeInTheDocument()

    // ID_Client 501 -> 'Client Alpha' (synthetic client name from fixtures).
    expect(await screen.findByText('Client Alpha')).toBeInTheDocument()

    // Sell_Price 48500 -> formatted as EUR.
    expect(screen.getByText('€48,500.00')).toBeInTheDocument()

    // A known field label is present (sanity check on the definition grid).
    expect(screen.getByText('Sell Price')).toBeInTheDocument()
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