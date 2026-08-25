import { describe, it, expect, vi } from 'vitest'
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
    // €48,500.00 ambiguous. Once recos load, Por Reconhecer = 12045
    // (48500 − 1455 Warranty_Reserve − 35000 instrument recognized).
    await screen.findByText('€12,045.00')
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
      expect(screen.getByText('€12,045.00')).toBeInTheDocument() // Por reconhecer (48500 − 1455 reserve − 35000)
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

  describe('per-row edit/delete + recognition state', () => {
    it('renders edit/delete buttons per recognition row for an editor', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByText('€35,000.00')

      // Each recognition row has distinct aria-labelled edit + delete buttons
      // (case-sensitive "reconhecimento" so they never collide with the page
      // "Editar" button or the "Adicionar Reconhecimento" action).
      expect(
        screen.getByRole('button', { name: /^Editar linha de reconhecimento 1$/ }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /^Apagar linha de reconhecimento 1$/ }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /^Editar linha de reconhecimento 3$/ }),
      ).toBeInTheDocument()
    })

    it('hides per-row edit/delete buttons for a viewer', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'viewer',
      })
      await screen.findByText('€35,000.00')
      expect(
        screen.queryByRole('button', { name: /^Editar linha de reconhecimento/ }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /^Apagar linha de reconhecimento/ }),
      ).not.toBeInTheDocument()
    })

    it('shows a green "Reconhecido" badge for past-dated recognition rows', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      // 1001's three recognitions are all dated 2025; "today" is Aug 2026 → each
      // row shows the "Reconhecido" badge and none shows "Por reconhecer".
      expect((await screen.findAllByText('Reconhecido')).length).toBeGreaterThanOrEqual(1)
      expect(screen.queryByText('Por reconhecer')).not.toBeInTheDocument()
    })

    it('opens an inline edit form for a recognition row', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByText('€35,000.00')

      fireEvent.click(screen.getByRole('button', { name: /^Editar linha de reconhecimento 1$/ }))
      // The inline edit row exposes the same labelled inputs as the add form.
      expect(screen.getAllByLabelText('Tipo de reconhecimento').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByLabelText('Valor do reconhecimento').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
    })
  })

  describe('warranty field visibility (req 4/11)', () => {
    it('shows warranty fields on a warranty order (1001, INSTR)', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      // Caracterização warranty rows + the Warranty Reserve revenue card +
      // the warranty KPI cards all render for a warranty order kind.
      expect(screen.getByText('Garantia')).toBeInTheDocument()
      expect(screen.getByText('Início Garantia')).toBeInTheDocument()
      expect(screen.getByText('Warranty Reserve')).toBeInTheDocument()
      expect(screen.getByText('Garantia Reconhecida')).toBeInTheDocument()
      expect(screen.getByText('Garantia por Reconhecer')).toBeInTheDocument()
    })

    it('omits warranty fields on a non-warranty order (1007, CM)', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1007',
        routePath: '/orders/:id',
      })
      await screen.findByRole('heading', { name: /Maintenance Co/ })
      // No warranty classification, no reserve, no warranty KPI cards.
      expect(screen.queryByText('Garantia')).not.toBeInTheDocument()
      expect(screen.queryByText('Início Garantia')).not.toBeInTheDocument()
      expect(screen.queryByText('Warranty Reserve')).not.toBeInTheDocument()
      expect(screen.queryByText('Garantia Reconhecida')).not.toBeInTheDocument()
      expect(screen.queryByText('Garantia por Reconhecer')).not.toBeInTheDocument()
    })
  })

  describe('propagation buttons (req 10/12)', () => {
    it('shows "Propagar garantia" only for a warranty order with >1 year', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1002',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Client Beta/ })
      // 1002 is INSTR with ID_Tp_Warranty=2 → (2-1)*12 = 12 lines → button shown.
      expect(screen.getByRole('button', { name: 'Propagar garantia' })).toBeInTheDocument()
      // A maintenance-contract order has no warranty propagation.
      expect(screen.queryByRole('button', { name: 'Propagar contrato' })).not.toBeInTheDocument()
    })

    it('hides "Propagar garantia" for a 1-year warranty (1001, 0 lines)', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      expect(screen.queryByRole('button', { name: 'Propagar garantia' })).not.toBeInTheDocument()
    })

    it('hides "Propagar garantia" on a non-warranty order and shows "Propagar contrato" for CM', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1007',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Maintenance Co/ })
      expect(screen.queryByRole('button', { name: 'Propagar garantia' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Propagar contrato' })).toBeInTheDocument()
    })

    it('opens the contract dialog with start date + years inputs', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1007',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Maintenance Co/ })
      fireEvent.click(screen.getByRole('button', { name: 'Propagar contrato' }))
      expect(screen.getByLabelText('Início do contrato')).toBeInTheDocument()
      expect(screen.getByLabelText('Nº de anos do contrato')).toHaveAttribute('min', '1')
      expect(screen.getByLabelText('Nº de anos do contrato')).toHaveAttribute('max', '100')
      expect(screen.getByLabelText('Nº de anos do contrato')).toHaveAttribute('step', '1')
      expect(screen.getByRole('button', { name: 'Propagar' })).toBeInTheDocument()
    })

    it('rejects fractional contract years before confirmation', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1007',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Maintenance Co/ })
      fireEvent.click(screen.getByRole('button', { name: 'Propagar contrato' }))
      fireEvent.change(screen.getByLabelText('Nº de anos do contrato'), {
        target: { value: '1.5' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Propagar' }))

      expect(screen.getByText(/nº de anos inteiro entre 1 e 100/i)).toBeInTheDocument()
      expect(confirm).not.toHaveBeenCalled()
      confirm.mockRestore()
    })

    it('confirms the normalized first day of the generated start month', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1007',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Maintenance Co/ })
      fireEvent.click(screen.getByRole('button', { name: 'Propagar contrato' }))
      fireEvent.change(screen.getByLabelText('Início do contrato'), {
        target: { value: '2025-01-15' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Propagar' }))

      expect(confirm).toHaveBeenCalledWith(expect.stringContaining('1 Jan 2025'))
      expect(confirm.mock.calls[0]?.[0]).not.toContain('15 Jan 2025')
      confirm.mockRestore()
    })
  })

  describe('recognition green highlight (req 6)', () => {
    it('highlights "Total Reconhecido" when it equals Sell Price (1002)', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1002',
        routePath: '/orders/:id',
      })
      await screen.findByRole('heading', { name: /Client Beta/ })
      // 1002: 125400 (T, instrument) + 6600 (WP, warranty) = 132000 == Sell_Price.
      // The reco query loads asynchronously (~120ms); until it resolves the
      // totals are computed from an empty reco list (totalReconhecido 0), so the
      // green highlight only appears once recos settle. Poll for it rather than
      // anchoring on a currency text — €125,400.00 also matches the pre-load
      // "Instrumento por Reconhecer" card (132000 − 6600 − 0), so findByText would
      // resolve before the highlight exists.
      await waitFor(() => {
        expect(document.querySelector('[data-highlight="true"]')).not.toBeNull()
      })
      const highlighted = document.querySelector('[data-highlight="true"]')!
      expect(highlighted).toHaveTextContent('Total Reconhecido')
    })

    it('does not highlight anything when Total Reconhecido is below Sell Price (1001)', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
      })
      await screen.findByText('€12,045.00')
      // 1001 total recognised 36455 < 48500 Sell_Price; no docs → net 0. No highlight.
      expect(document.querySelector('[data-highlight="true"]')).toBeNull()
    })
  })

  describe('document type select + invoicing limits (req 2/5/6)', () => {
    it('uses the Tp_Doc_FT reference list (AcFT/FT/NC, no ND) in the add form', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1004',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Demo Hospital/ })
      // Open the Faturação tab where the documentos table's add form lives.
      fireEvent.click(screen.getByRole('tab', { name: 'Faturação' }))
      await screen.findByText('Sem documentos.')
      fireEvent.click(await screen.findByRole('button', { name: /Adicionar documento/ }))
      const typeSelect = screen.getByLabelText('Tipo de documento')
      expect(typeSelect).toBeInTheDocument()
      // The select offers the descriptive Tp_Doc_FT labels, not bare codes,
      // and never offers the non-existent "ND".
      const options = Array.from(typeSelect.querySelectorAll('option')).map((o) => o.textContent)
      expect(options).toEqual(['Acerto Factura', 'Factura', 'Nota Crédito'])
      expect(options).not.toContain('ND')
    })

    it('blocks a document whose value would exceed Sell Price (req 5)', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1004',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Demo Hospital/ })
      fireEvent.click(screen.getByRole('tab', { name: 'Faturação' }))
      await screen.findByText('Sem documentos.')
      fireEvent.click(await screen.findByRole('button', { name: /Adicionar documento/ }))

      fireEvent.change(screen.getByLabelText('Número do documento'), { target: { value: 'FT-1' } })
      fireEvent.change(screen.getByLabelText('Valor do documento'), { target: { value: '999999' } })
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

      // 1004 Sell_Price is 39500; 999999 exceeds it → client-side guard fires.
      expect(
        await screen.findByText(/net faturado não pode ultrapassar o Sell Price/),
      ).toBeInTheDocument()
    })
  })

  describe('mutation cache synchronization (task #11)', () => {
    it('updates a recognition row in the cache from the mutation result', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByText('€35,000.00')

      fireEvent.click(screen.getByRole('button', { name: /^Editar linha de reconhecimento 1$/ }))
      fireEvent.change(screen.getByLabelText('Valor do reconhecimento'), {
        target: { value: '9000' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

      // The returned row replaces id 1 in the recognition list cache, so the new
      // value renders without a refetch. Edit mode also exits (no "Guardar").
      expect(await screen.findByText('€9,000.00')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
    })

    it('removes a recognition row from the cache optimistically on delete', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByText('€35,000.00')
      expect(
        screen.getByRole('button', { name: /^Apagar linha de reconhecimento 1$/ }),
      ).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /^Apagar linha de reconhecimento 1$/ }))

      // The delete hook removes the row optimistically (onMutate) and does NOT
      // invalidate the recognition subtable, so id 1's actions vanish in the same
      // render — proving the cache was updated from the mutation, not a refetch.
      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: /^Editar linha de reconhecimento 1$/ }),
        ).not.toBeInTheDocument()
      })
      expect(
        screen.queryByRole('button', { name: /^Apagar linha de reconhecimento 1$/ }),
      ).not.toBeInTheDocument()
      confirm.mockRestore()
    })

    it('removes a documento row from the cache optimistically on delete', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      fireEvent.click(screen.getByRole('tab', { name: 'Faturação' }))
      expect(await screen.findByText('FT 2025/0001')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /^Apagar linha de documento 1$/ }))

      // Optimistic removal from the invoicing cache — the document number
      // disappears without waiting for a refetch.
      await waitFor(() => {
        expect(screen.queryByText('FT 2025/0001')).not.toBeInTheDocument()
      })
      confirm.mockRestore()
    })
  })
})
