import { describe, it, expect } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
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

    // Revenue is the default tab; it surfaces the sell price. Wait for the
    // recognition data to settle first — until it loads, the "Instrumento Por
    // Reconhecer" placeholder equals Sell_Price (48500 − 0), which would make
    // €48,500.00 ambiguous. Once recos load, Por Reconhecer = 13500.
    await screen.findByText('€13,500.00')
    expect(screen.getByText('Sell Price')).toBeInTheDocument()
    expect(screen.getByText('€48,500.00')).toBeInTheDocument()

    // Order # is shown in the header sub-line.
    expect(screen.getByText(/Order #1001/)).toBeInTheDocument()
  })

  it('renders three tabs with the Revenue tab active by default', async () => {
    renderWithProviders(<OrderDetailPage />, {
      initialPath: '/orders/1001',
      routePath: '/orders/:id',
    })

    const tablist = await screen.findByRole('tablist', { name: 'Order details' })
    expect(tablist).toBeInTheDocument()

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(tabs[0]).toHaveTextContent('Revenue')
    expect(tabs[1]).toHaveTextContent('Faturação')
    expect(tabs[2]).toHaveTextContent('Observações')

    // Revenue is selected and in the tab order; the others are not.
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveAttribute('tabindex', '0')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
    expect(tabs[1]).toHaveAttribute('tabindex', '-1')

    // The active tab controls the rendered panel and the panel is labelled by it.
    const panel = screen.getByRole('tabpanel')
    expect(tabs[0]).toHaveAttribute('aria-controls', panel.getAttribute('id'))
    expect(panel).toHaveAttribute('aria-labelledby', tabs[0].getAttribute('id'))
    expect(tabs[1]).not.toHaveAttribute('aria-controls')
  })

  it('switches panels when a tab is clicked', async () => {
    renderWithProviders(<OrderDetailPage />, {
      initialPath: '/orders/1001',
      routePath: '/orders/:id',
    })

    await screen.findByRole('heading', { name: /Client Alpha/ })
    // Orçamento/Proposta lives only on the Faturação tab.
    expect(screen.queryByText('Orçamento/Proposta')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Faturação' }))
    expect(screen.getByText('Orçamento/Proposta')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Faturação' })).toHaveAttribute('aria-selected', 'true')

    // Observações textarea label lives only on the Observações tab.
    expect(screen.queryByLabelText('Observações')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Observações' }))
    expect(screen.getByText('Synthetic demo order for Client Alpha.')).toBeInTheDocument()
  })

  it('renders the not-found state when the order id does not exist', async () => {
    renderWithProviders(<OrderDetailPage />, {
      initialPath: '/orders/99999',
      routePath: '/orders/:id',
    })

    expect(await screen.findByText('Order not found')).toBeInTheDocument()
    expect(screen.getByText('This order may have been removed.')).toBeInTheDocument()
  })

  it('renders the not-found state for an invalid (non-numeric) id', async () => {
    renderWithProviders(<OrderDetailPage />, {
      initialPath: '/orders/abc',
      routePath: '/orders/:id',
    })

    expect(await screen.findByText('Order not found')).toBeInTheDocument()
    expect(screen.getByText('The order identifier is invalid.')).toBeInTheDocument()
  })

  it('renders a Back button on the not-found state', async () => {
    renderWithProviders(<OrderDetailPage />, {
      initialPath: '/orders/abc',
      routePath: '/orders/:id',
    })

    expect(await screen.findByRole('button', { name: /voltar/i })).toBeInTheDocument()
  })

  describe('estado badge', () => {
    it('shows Histórico for a past-month non-Provisória order (1001, 2025-09)', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
      })
      // 1001 is Sept 2025; "today" is Aug 2026 → past month → Histórico.
      expect(await screen.findByText('Histórico')).toBeInTheDocument()
    })

    it('shows Provisório for a Provisória order regardless of date', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1002',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      // 1002 is Provisória=true → Provisório.
      expect(await screen.findByText('Provisório')).toBeInTheDocument()
      // No "mês fechado" warning for a provisória order.
      expect(screen.queryByText(/Mês fechado/)).not.toBeInTheDocument()
    })
  })

  describe('edit mode + field locks', () => {
    it('shows an Editar button for an editor but not for a viewer', async () => {
      const { unmount } = renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      expect(await screen.findByRole('button', { name: 'Editar' })).toBeInTheDocument()
      unmount()

      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'viewer',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    })

    it('locks caracterização fields for an editor on a histórico order', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByText('Histórico')

      fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

      // Sell Price is locked after month close.
      const sellPrice = screen.getByLabelText('Sell Price')
      expect(sellPrice).toBeDisabled()
      // A lock indicator is rendered next to the locked label.
      expect(screen.getAllByLabelText('Campo bloqueado (mês fechado)').length).toBeGreaterThan(0)

      // Obs (Observações tab) is NOT locked even on a histórico order. The query
      // is scoped to `textarea` because the Observações tabpanel is also labelled
      // "Observações" (via aria-labelledby) and would otherwise match too.
      fireEvent.click(screen.getByRole('tab', { name: 'Observações' }))
      const obs = screen.getByLabelText('Observações', { selector: 'textarea' })
      expect(obs).not.toBeDisabled()
    })

    it('unlocks caracterização fields for an admin on a histórico order', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'admin',
      })
      await screen.findByText('Histórico')

      fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

      const sellPrice = screen.getByLabelText('Sell Price')
      expect(sellPrice).not.toBeDisabled()
      // No lock indicators for admin.
      expect(screen.queryByLabelText('Campo bloqueado (mês fechado)')).not.toBeInTheDocument()
    })

    it('unlocks caracterização fields for an editor on a Provisória order', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1002',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByText('Provisório')

      fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

      // Sell Price is editable on a provisória order even for an editor.
      const sellPrice = screen.getByLabelText('Sell Price')
      expect(sellPrice).not.toBeDisabled()
      expect(screen.queryByLabelText('Campo bloqueado (mês fechado)')).not.toBeInTheDocument()
    })

    it('saves a changed field and exits edit mode', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })

      fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

      // Edit an unlocked field on the Faturação tab.
      fireEvent.click(screen.getByRole('tab', { name: 'Faturação' }))
      const orc = screen.getByLabelText('Orçamento/Proposta')
      fireEvent.change(orc, { target: { value: 'ORC-9999' } })

      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

      // Exits edit mode → Cancelar disappears, Editar reappears.
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
      })
      expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
    })

    it('reverts the draft on Cancelar', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })

      fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

      // Orçamento/Proposta lives on the Faturação tab (Revenue is the default).
      fireEvent.click(screen.getByRole('tab', { name: 'Faturação' }))
      const orc = screen.getByLabelText('Orçamento/Proposta')
      fireEvent.change(orc, { target: { value: 'ORC-9999' } })
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

      // Back to view mode; the original value (ORC-1001) is displayed again.
      expect(screen.getByText('ORC-1001')).toBeInTheDocument()
      expect(screen.queryByText('ORC-9999')).not.toBeInTheDocument()
    })
  })

  describe('role switching', () => {
    it('switching the Permissão control to viewer hides the Editar button', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('button', { name: 'Editar' })

      fireEvent.change(screen.getByLabelText('Permissão'), { target: { value: 'viewer' } })

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
      })
    })
  })

  describe('Orc_Proposta rendering', () => {
    it('renders Orc_Proposta as a string reference, not a currency value', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })

      // The fixture value is the string "ORC-1001" (an nvarchar reference), shown
      // on the Faturação tab — never formatted as € currency.
      fireEvent.click(screen.getByRole('tab', { name: 'Faturação' }))
      expect(screen.getByText('ORC-1001')).toBeInTheDocument()
      // A currency-formatted version of that string would never appear.
      expect(screen.queryByText('€ORC-1001.00')).not.toBeInTheDocument()
    })
  })

  describe('reconhecimentos + documentos tables', () => {
    it('renders the recognition entries and the instrument/warranty split on the Revenue tab', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })

      // 1001 has two Parcial (P) entries (15000 + 20000 = 35000 instrument) and one
      // Warranty (W) entry (1455). The recognition query has ~120ms latency, so the
      // computed values only appear once it resolves — await the first one.
      expect(await screen.findByText('€35,000.00')).toBeInTheDocument() // Instrumento Reconhecido
      expect(screen.getByText('€13,500.00')).toBeInTheDocument() // Por reconhecer (48500 − 35000)
      // €1,455.00 is intentionally ambiguous: it's both the Warranty Reserve field
      // value AND the Garantia Reconhecido computed value on this order.
      expect(screen.getAllByText('€1,455.00').length).toBeGreaterThanOrEqual(1)

      // The recognition rows themselves (type labels) appear in the table.
      expect(screen.getAllByText('Parcial').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Warranty')).toBeInTheDocument()
    })

    it('renders the invoicing documents and the net-invoiced total on the Faturação tab', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1002',
        routePath: '/orders/:id',
      })
      await screen.findByRole('heading', { name: /Client Beta/ })

      fireEvent.click(screen.getByRole('tab', { name: 'Faturação' }))
      // 1002 has FT 66000 + FT 66000 + NC -3000 = 129000 net. The documents query
      // has ~120ms latency; until it resolves the table shows "Sem documentos."
      // (not the tfoot), so await the net-invoiced label.
      expect(await screen.findByText('Net faturado')).toBeInTheDocument()
      expect(screen.getByText('€129,000.00')).toBeInTheDocument()
      // The Nota Crédito row (negative) is rendered.
      expect(screen.getAllByText('Nota Crédito').length).toBeGreaterThanOrEqual(1)
    })

    it('shows a [+ Reconhecimento] button for an editor and lets them add an entry', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1004',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Demo Hospital/ })

      // 1004 has no recognition entries → empty state, but the add button is present.
      expect(await screen.findByText('Sem reconhecimentos.')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /Reconhecimento/ }))

      // Fill the inline form and add.
      fireEvent.change(screen.getByLabelText('Valor do reconhecimento'), {
        target: { value: '5000' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

      // After the add + refetch, the new row's Valor (5000) and the Instrumento
      // Reconhecido computed value both read €5,000.00 — ambiguous. Assert the
      // UNIQUE "Por Reconhecer" instead: Sell_Price 39500 − 5000 = 34500.
      expect(await screen.findByText('€34,500.00')).toBeInTheDocument()
      expect(screen.queryByText('Sem reconhecimentos.')).not.toBeInTheDocument()
    })

    it('hides the [+ Reconhecimento] button for a viewer', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'viewer',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      expect(screen.queryByRole('button', { name: /Reconhecimento/ })).not.toBeInTheDocument()
    })
  })
})
