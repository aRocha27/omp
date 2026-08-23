import { describe, it, expect } from 'vitest'
import { screen, within, fireEvent } from '@testing-library/react'
import { OrdersPage } from '@/features/orders/orders-page'
import { renderWithProviders } from '@/test/render-with-providers'

/** Find the `<select>` whose `<option>` values include every given value. */
function selectByOptionValues(values: string[]): HTMLSelectElement {
  const selects = screen.getAllByRole('combobox')
  return selects.find((s) => {
    const opts = Array.from((s as HTMLSelectElement).options).map((o) => o.value)
    return values.every((v) => opts.includes(v))
  }) as HTMLSelectElement
}

/** Find the `<select>` that has an `<option>` with the given value. */
function selectByOptionValue(value: string): HTMLSelectElement {
  return selectByOptionValues([value])
}

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

  it('narrows results when filtering by the Order type dropdown', async () => {
    renderWithProviders(<OrdersPage />, { initialPath: '/orders' })
    await screen.findByRole('table')

    // Locate the Order type select by its option value 'FAB'.
    const typeSelect = selectByOptionValue('FAB')
    expect(typeSelect).toBeTruthy()
    fireEvent.change(typeSelect, { target: { value: 'FAB' } })

    // FAB orders are 1002 (Client Beta) and 1003 (Test Dealer); STD orders gone.
    expect(await screen.findByText('Client Beta')).toBeInTheDocument()
    expect(screen.queryByText('Client Alpha')).not.toBeInTheDocument()
    expect(screen.queryByText('Demo Hospital')).not.toBeInTheDocument()
  })

  it('narrows results when filtering by the Area dropdown', async () => {
    renderWithProviders(<OrdersPage />, { initialPath: '/orders' })
    await screen.findByRole('table')

    // Area is the only select whose options include both '1' and '2'.
    const areaSelect = selectByOptionValues(['1', '2'])
    fireEvent.change(areaSelect, { target: { value: '2' } })

    // Area 2 orders are 1003 (Test Dealer) and 1004 (Demo Hospital).
    expect(await screen.findByText('Test Dealer')).toBeInTheDocument()
    expect(screen.queryByText('Client Beta')).not.toBeInTheDocument()
  })

  it('associates each filter label with its control for screen readers', async () => {
    renderWithProviders(<OrdersPage />, { initialPath: '/orders' })
    await screen.findByRole('table')

    // Labels point at the controls themselves (htmlFor -> control id), not at
    // a wrapper div, so getByLabelText resolves to the input/select.
    expect((screen.getByLabelText('Area') as HTMLElement).tagName).toBe('SELECT')
    expect((screen.getByLabelText('Order type') as HTMLElement).tagName).toBe('SELECT')
    expect((screen.getByLabelText('Client') as HTMLElement).tagName).toBe('INPUT')
    expect((screen.getByLabelText('PHC ref') as HTMLElement).tagName).toBe('INPUT')
  })
})