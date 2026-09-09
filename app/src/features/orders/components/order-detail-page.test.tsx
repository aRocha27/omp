import { describe, it, expect } from 'vitest'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import { OrderDetailPage, invoicingStatus } from '@/features/orders/components/order-detail-page'
import { renderWithProviders } from '@/test/render-with-providers'

/**
 * Drive the DatePicker by typing into its text input.
 *
 * The picker displays `dd/mm/yyyy` and only commits to `onChange` once the
 * typed value parses to a real calendar date. This helper takes the ISO we
 * want to land on and converts it to the display format the user would type,
 * then fires `change` with that string. Passing `''` clears the field, which
 * the picker translates into `onChange(null)`.
 */
function setDatePicker(label: string, iso: string) {
  const input = screen.getByLabelText(label)
  if (iso === '') {
    fireEvent.change(input, { target: { value: '' } })
    return
  }
  const [y, m, d] = iso.split('-')
  fireEvent.change(input, { target: { value: `${d}/${m}/${y}` } })
}

describe('invoicingStatus (derived invoicing status)', () => {
  it('is "Fully Invoiced" when net equals Sell Price', () => {
    expect(invoicingStatus(12000, 12000)).toEqual({ tone: 'success', label: 'Fully Invoiced' })
    expect(invoicingStatus(12000.004, 12000)).toEqual({ tone: 'success', label: 'Fully Invoiced' })
  })
  it('is "Partially Invoiced" when net is positive but below Sell Price', () => {
    expect(invoicingStatus(29250, 48500)).toEqual({ tone: 'warning', label: 'Partially Invoiced' })
  })
  it('is "Not Invoiced" when net is zero or Sell Price is missing', () => {
    expect(invoicingStatus(0, 48500)).toEqual({ tone: 'neutral', label: 'Not Invoiced' })
    expect(invoicingStatus(0, null)).toEqual({ tone: 'neutral', label: 'Not Invoiced' })
  })
})

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
    expect(tabs[1]).toHaveTextContent('Invoicing')
    expect(tabs[2]).toHaveTextContent('Notes')

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
    // Quote / Proposal lives only on the Invoicing tab.
    expect(screen.queryByText('Quote / Proposal')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Invoicing' }))
    expect(screen.getByText('Quote / Proposal')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Invoicing' })).toHaveAttribute('aria-selected', 'true')

    // Notes textarea label lives only on the Notes tab.
    expect(screen.queryByLabelText('Notes')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }))
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

    expect(await screen.findByRole('button', { name: /back/i })).toBeInTheDocument()
  })

  describe('estado badge', () => {
    it('shows Historical for a past-month non-Provisória order (1001, 2025-09)', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
      })
      // 1001 is Sept 2025; "today" is Aug 2026 → past month → Historical.
      expect(await screen.findByText('Historical')).toBeInTheDocument()
    })

    it('shows Provisional for a Provisória order regardless of date', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1002',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      // 1002 is Provisória=true → Provisional.
      expect(await screen.findByText('Provisional')).toBeInTheDocument()
      // No "mês fechado" warning for a provisória order.
      expect(screen.queryByText(/Month closed/)).not.toBeInTheDocument()
    })
  })

  describe('edit mode + field locks', () => {
    it('always shows an Edit button for users and editors but not for a viewer', async () => {
      const { unmount } = renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
      unmount()

      const userView = renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'user',
      })
      expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
      userView.unmount()

      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'viewer',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    })

    it('lets a user fill blank warranty fields while other characterization fields stay locked', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1004',
        routePath: '/orders/:id',
        initialRole: 'user',
      })
      await screen.findByText('Historical')

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

      expect(screen.getByLabelText('Warranty')).not.toBeDisabled()
      expect(screen.getByLabelText('Warranty Start')).not.toBeDisabled()
      expect(screen.getByLabelText('Sell Price')).toBeDisabled()

      fireEvent.click(screen.getByRole('tab', { name: 'Invoicing' }))
      expect(screen.getByLabelText('Quote / Proposal')).toBeDisabled()
      expect(screen.getByLabelText('Customer PO')).toBeDisabled()
      expect(screen.getByLabelText('Order email')).toBeDisabled()
      expect(screen.getByLabelText('Customer Contact')).toBeDisabled()
    })

    it('keeps populated Warranty and Warranty Start editable for a user', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'user',
      })
      await screen.findByText('Historical')

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

      expect(screen.getByLabelText('Warranty')).not.toBeDisabled()
      expect(screen.getByLabelText('Warranty Start')).not.toBeDisabled()
      expect(screen.getByLabelText('Sell Price')).toBeDisabled()
    })

    it('unlocks every characterization field for a non-Client order regardless of date', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1004',
        routePath: '/orders/:id',
        initialRole: 'user',
      })
      await screen.findByText('Historical')

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

      // 1004 has Tipo_Warranty=true and ID_Tp_Order 'C', so the user can edit Warranty
      // and Warranty Start but Sell Price / Order Date / Client stay locked. (The
      // non-Client unlock path is covered by order-policy.test.ts; this is the
      // UI integration for the locked-Client-row case.)
      expect(screen.getByLabelText('Warranty')).not.toBeDisabled()
      expect(screen.getByLabelText('Warranty Start')).not.toBeDisabled()
      expect(screen.getByLabelText('Sell Price')).toBeDisabled()
      expect(screen.getByLabelText('Order Date')).toBeDisabled()
      expect(screen.getByLabelText('Area')).toBeDisabled()
    })

    it('locks caracterização fields for an editor on a histórico order', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByText('Historical')

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

      // Sell Price is locked after month close.
      const sellPrice = screen.getByLabelText('Sell Price')
      expect(sellPrice).toBeDisabled()
      // A lock indicator is rendered next to the locked label.
      expect(screen.getAllByLabelText('Field locked (month closed)').length).toBeGreaterThan(0)

      // Obs (Notes tab) is NOT locked even on a histórico order. The query
      // is scoped to `textarea` because the Notes tabpanel is also labelled
      // "Notes" (via aria-labelledby) and would otherwise match too.
      fireEvent.click(screen.getByRole('tab', { name: 'Notes' }))
      const obs = screen.getByLabelText('Notes', { selector: 'textarea' })
      expect(obs).not.toBeDisabled()
    })

    it('unlocks caracterização fields for an admin on a histórico order', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'admin',
      })
      await screen.findByText('Historical')

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

      const sellPrice = screen.getByLabelText('Sell Price')
      expect(sellPrice).not.toBeDisabled()
      // No lock indicators for admin.
      expect(screen.queryByLabelText('Field locked (month closed)')).not.toBeInTheDocument()
    })

    it('unlocks caracterização fields for an editor on a Provisória order', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1002',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByText('Provisional')

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

      // Sell Price is editable on a provisória order even for an editor.
      const sellPrice = screen.getByLabelText('Sell Price')
      expect(sellPrice).not.toBeDisabled()
      expect(screen.queryByLabelText('Field locked (month closed)')).not.toBeInTheDocument()
    })

    it('saves a changed field and exits edit mode', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

      // Edit an unlocked field on the Invoicing tab.
      fireEvent.click(screen.getByRole('tab', { name: 'Invoicing' }))
      const orc = screen.getByLabelText('Quote / Proposal')
      fireEvent.change(orc, { target: { value: 'ORC-9999' } })

      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      // Exits edit mode → Cancel disappears, Edit reappears.
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
      })
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    })

    it('reverts the draft on Cancel', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

      // Quote / Proposal lives on the Invoicing tab (Revenue is the default).
      fireEvent.click(screen.getByRole('tab', { name: 'Invoicing' }))
      const orc = screen.getByLabelText('Quote / Proposal')
      fireEvent.change(orc, { target: { value: 'ORC-9999' } })
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      // Back to view mode; the original value (ORC-1001) is displayed again.
      expect(screen.getByText('ORC-1001')).toBeInTheDocument()
      expect(screen.queryByText('ORC-9999')).not.toBeInTheDocument()
    })
  })

  describe('role switching', () => {
    it('switching the Permissão control to viewer hides the Edit button', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('button', { name: 'Edit' })

      fireEvent.change(screen.getByLabelText('Permission'), { target: { value: 'viewer' } })

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
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
      // on the Invoicing tab — never formatted as € currency.
      fireEvent.click(screen.getByRole('tab', { name: 'Invoicing' }))
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

      // 1001 has two Partial (P) entries (15000 + 20000 = 35000 instrument) and one
      // Warranty (W) entry (1455). The recognition query has ~120ms latency, so the
      // computed values only appear once it resolves — await the first one.
      expect(await screen.findByText('€35,000.00')).toBeInTheDocument() // Instrument Recognised
      expect(screen.getByText('€12,045.00')).toBeInTheDocument() // Por reconhecer (48500 − 1455 reserve − 35000)
      // €1,455.00 is intentionally ambiguous: it's both the Warranty Reserve field
      // value AND the Warranty Reconhecido computed value on this order.
      expect(screen.getAllByText('€1,455.00').length).toBeGreaterThanOrEqual(1)

      // The recognition rows themselves (type labels) appear in the table.
      expect(screen.getAllByText('Partial').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Warranty').length).toBeGreaterThanOrEqual(1)
    })

    it('renders the invoicing documents and the net-invoiced total on the Invoicing tab', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1002',
        routePath: '/orders/:id',
      })
      await screen.findByRole('heading', { name: /Client Beta/ })

      fireEvent.click(screen.getByRole('tab', { name: 'Invoicing' }))
      // 1002 has FT 66000 + FT 66000 + NC -3000 = 129000 net. The documents query
      // has ~120ms latency; until it resolves the table shows "No documents."
      // (not the tfoot), so await the net-invoiced label.
      expect(await screen.findByText('Net faturado')).toBeInTheDocument()
      expect(screen.getByText('€129,000.00')).toBeInTheDocument()
      // The Credit Note row (negative) is rendered.
      expect(screen.getAllByText('Credit Note').length).toBeGreaterThanOrEqual(1)
    })

    it('shows a [+ Reconhecimento] button for an editor and lets them add an entry', async () => {
      // Adding stays open for any non-viewer regardless of the order's month,
      // so the editor (not admin) exercises the add flow here.
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1004',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Demo Hospital/ })

      // 1004 has no recognition entries → empty state, but the add button is present.
      expect(await screen.findByText('No recognitions.')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /Recognition/ }))

      // Fill the inline form and add.
      fireEvent.change(screen.getByLabelText('Recognition value'), {
        target: { value: '5000' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))

      // After the add + refetch, the new row's Value (5000) and the Instrumento
      // Reconhecido computed value both read €5,000.00 — ambiguous. Assert the
      // UNIQUE "Por Reconhecer" instead: Sell_Price 39500 − 5000 = 34500.
      expect(await screen.findByText('€34,500.00')).toBeInTheDocument()
      expect(screen.queryByText('No recognitions.')).not.toBeInTheDocument()
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
    it('renders edit/delete buttons per recognition row for an admin', async () => {
      // 1001 is historical (Sept 2025); editor financial mutations are locked out,
      // so the per-row actions only render for an admin.
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'admin',
      })
      await screen.findByText('€35,000.00')

      // Each recognition row has distinct aria-labelled edit + delete buttons
      // (case-sensitive "reconhecimento" so they never collide with the page
      // "Edit" button or the "Add Recognition" action).
      expect(
        screen.getByRole('button', { name: /^Edit recognition row 1$/ }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /^Delete recognition row 1$/ }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /^Edit recognition row 3$/ }),
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
        screen.queryByRole('button', { name: /^Edit recognition row/ }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /^Delete recognition row/ }),
      ).not.toBeInTheDocument()
    })

    it('shows a green "Recognized" badge for past-dated recognition rows', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      // 1001's three recognitions are all dated 2025; "today" is Aug 2026 → each
       // row shows the "Recognized" badge and none shows "To recognize".
       expect((await screen.findAllByText('Recognized')).length).toBeGreaterThanOrEqual(1)
       expect(screen.queryByText('To recognize')).not.toBeInTheDocument()
    })

    it('opens an inline edit form for a recognition row', async () => {
      // 1001 is historical; admin is required to surface the per-row edit button.
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'admin',
      })
      await screen.findByText('€35,000.00')

      fireEvent.click(screen.getByRole('button', { name: /^Edit recognition row 1$/ }))
      // The inline edit row exposes the same labelled inputs as the add form.
      expect(screen.getAllByLabelText('Recognition type').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByLabelText('Recognition value').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
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
      expect(screen.getAllByText('Warranty').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Warranty Start')).toBeInTheDocument()
      expect(screen.getByText('Warranty Reserve')).toBeInTheDocument()
      expect(screen.getByText('Warranty Recognised')).toBeInTheDocument()
      expect(screen.getByText('Warranty to Recognise')).toBeInTheDocument()
    })

    it('omits warranty fields on a non-warranty order (1007, CM)', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1007',
        routePath: '/orders/:id',
      })
      await screen.findByRole('heading', { name: /Maintenance Co/ })
      // No warranty classification, no reserve, no warranty KPI cards.
      expect(screen.queryByText('Warranty')).not.toBeInTheDocument()
      expect(screen.queryByText('Warranty Start')).not.toBeInTheDocument()
      expect(screen.queryByText('Warranty Reserve')).not.toBeInTheDocument()
      expect(screen.queryByText('Warranty Recognised')).not.toBeInTheDocument()
      expect(screen.queryByText('Warranty to Recognise')).not.toBeInTheDocument()
    })
  })

  describe('propagation buttons (req 10/12)', () => {
    it('shows "Propagate warranty" only for a warranty order with >1 year', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1002',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Client Beta/ })
      // 1002 is INSTR with ID_Tp_Warranty=2 → (2-1)*12 = 12 lines → button shown.
      expect(screen.getByRole('button', { name: 'Propagate warranty' })).toBeInTheDocument()
      // A maintenance-contract order has no warranty propagation.
      expect(screen.queryByRole('button', { name: 'Propagate contract' })).not.toBeInTheDocument()
    })

    it('hides "Propagate warranty" for a 1-year warranty (1001, 0 lines)', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      expect(screen.queryByRole('button', { name: 'Propagate warranty' })).not.toBeInTheDocument()
    })

    it('hides "Propagate warranty" on a non-warranty order and shows "Propagate contract" for CM', async () => {
      // 1007 is historical non-provisória; editor still sees the Propagate contract
      // button because propagation creates new rows (which is always allowed).
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1007',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Maintenance Co/ })
      expect(screen.queryByRole('button', { name: 'Propagate warranty' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Propagate contract' })).toBeInTheDocument()
    })

    it('opens the contract dialog with start, recognition date, and years inputs', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1007',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Maintenance Co/ })
      fireEvent.click(screen.getByRole('button', { name: 'Propagate contract' }))
      expect(screen.getByLabelText('Contract start')).toBeInTheDocument()
      // The picker displays dd/mm/yyyy; the parent state stays ISO under the hood.
      const today = new Date()
      const expectedDisplay = `${String(today.getUTCDate()).padStart(2, '0')}/${String(
        today.getUTCMonth() + 1,
      ).padStart(2, '0')}/${today.getUTCFullYear()}`
      expect(screen.getByLabelText('Recognition date')).toHaveValue(expectedDisplay)
      expect(screen.getByLabelText('Contract years')).toHaveAttribute('min', '1')
      expect(screen.getByLabelText('Contract years')).toHaveAttribute('max', '100')
      expect(screen.getByLabelText('Contract years')).toHaveAttribute('step', '1')
      expect(screen.getByRole('button', { name: 'Propagate' })).toBeInTheDocument()
    })

    it('rejects fractional contract years before opening the confirmation dialog', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1007',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Maintenance Co/ })
      fireEvent.click(screen.getByRole('button', { name: 'Propagate contract' }))
      fireEvent.change(screen.getByLabelText('Contract years'), {
        target: { value: '1.5' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Propagate' }))

      expect(screen.getByText(/whole number of years between 1 and 100/i)).toBeInTheDocument()
      // Validation fails before any confirmation dialog is shown.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('opens the confirmation dialog with the normalized first day of the start month', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1007',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Maintenance Co/ })
      fireEvent.click(screen.getByRole('button', { name: 'Propagate contract' }))
      setDatePicker('Contract start', '2025-01-15')
      setDatePicker('Recognition date', '2025-01-15')
      fireEvent.click(screen.getByRole('button', { name: 'Propagate' }))

      const dialog = await screen.findByRole('dialog')
      expect(dialog).toHaveTextContent('01/01/2025')
      expect(dialog).not.toHaveTextContent('15/01/2025')
    })

    it('shows catch-up from the recognition month in the confirmation dialog', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1007',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Maintenance Co/ })
      fireEvent.click(screen.getByRole('button', { name: 'Propagate contract' }))
      setDatePicker('Contract start', '2026-01-15')
      setDatePicker('Recognition date', '2026-06-25')
      fireEvent.click(screen.getByRole('button', { name: 'Propagate' }))

      const dialog = await screen.findByRole('dialog')
      expect(dialog).toHaveTextContent('01/06/2026')
    })

    it('rejects a missing recognition date before opening the confirmation dialog', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1007',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Maintenance Co/ })
      fireEvent.click(screen.getByRole('button', { name: 'Propagate contract' }))
      setDatePicker('Recognition date', '')
      fireEvent.click(screen.getByRole('button', { name: 'Propagate' }))

      expect(screen.getByRole('alert')).toHaveTextContent(/recognition date/i)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('creates maintenance recognitions after confirming the dialog', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1007',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Maintenance Co/ })
      // 1007 is a CM order with Sell_Price 12000 and no existing recognitions.
      expect(await screen.findByText('No recognitions.')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Propagate contract' }))
      setDatePicker('Contract start', '2025-01-15')
      setDatePicker('Recognition date', '2025-01-15')
      fireEvent.click(screen.getByRole('button', { name: 'Propagate' }))

      // The in-app confirmation dialog opens; its Confirm button is scoped to
      // the dialog (the contract form also has a "Propagate" button).
      const dialog = await screen.findByRole('dialog')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Propagate' }))

      // 12 monthly CM lines of €1,000 are created (12000 / 12). The mutation
      // appends them to the cache, so the rows render without a refetch.
      const rows = await screen.findAllByText('Maintenance Contract')
      expect(rows).toHaveLength(12)
      // The dialog closes on success.
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('does not create recognitions when the confirmation dialog is cancelled', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1007',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Maintenance Co/ })
      expect(await screen.findByText('No recognitions.')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Propagate contract' }))
      setDatePicker('Contract start', '2025-01-15')
      setDatePicker('Recognition date', '2025-01-15')
      fireEvent.click(screen.getByRole('button', { name: 'Propagate' }))

      const dialog = await screen.findByRole('dialog')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      // No mutation fired — the empty state remains.
      expect(screen.queryByText('Maintenance Contract')).not.toBeInTheDocument()
      expect(screen.getByText('No recognitions.')).toBeInTheDocument()
    })
  })

  describe('recognition green highlight (req 6)', () => {
    it('highlights "Total Recognised" when it equals Sell Price (1002)', async () => {
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
      // "Instrument to Recognise" card (132000 − 6600 − 0), so findByText would
      // resolve before the highlight exists.
      await waitFor(() => {
        expect(document.querySelector('[data-highlight="true"]')).not.toBeNull()
      })
      const highlighted = document.querySelector('[data-highlight="true"]')!
      expect(highlighted).toHaveTextContent('Total Recognised')
    })

    it('does not highlight anything when Total Recognised is below Sell Price (1001)', async () => {
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
    // 1004 is historical; editor can still Add (the month lock only gates
    // edit/delete of existing rows), so the editor exercises the add flow here.
    it('uses the Tp_Doc_FT reference list (AcFT/FT/NC, no ND) in the add form', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1004',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Demo Hospital/ })
      // Open the Invoicing tab where the documentos table's add form lives.
      fireEvent.click(screen.getByRole('tab', { name: 'Invoicing' }))
      await screen.findByText('No documents.')
      fireEvent.click(await screen.findByRole('button', { name: /Add document/ }))
      const typeSelect = screen.getByLabelText('Document type')
      expect(typeSelect).toBeInTheDocument()
      // The select offers the descriptive Tp_Doc_FT labels, not bare codes,
      // and never offers the non-existent "ND".
      const options = Array.from(typeSelect.querySelectorAll('option')).map((o) => o.textContent)
      expect(options).toEqual(['Invoice Adjustment', 'Invoice', 'Credit Note'])
      expect(options).not.toContain('ND')
    })

    it('blocks a document whose value would exceed Sell Price (req 5)', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1004',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Demo Hospital/ })
      fireEvent.click(screen.getByRole('tab', { name: 'Invoicing' }))
      await screen.findByText('No documents.')
      fireEvent.click(await screen.findByRole('button', { name: /Add document/ }))

      fireEvent.change(screen.getByLabelText('Document number'), { target: { value: 'FT-1' } })
      fireEvent.change(screen.getByLabelText('Document value'), { target: { value: '999999' } })
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))

      // 1004 Sell_Price is 39500; 999999 exceeds it → client-side guard fires.
      expect(
        await screen.findByText(/net invoiced cannot exceed the Sell Price/i),
      ).toBeInTheDocument()
    })

    it('shows the remaining-to-Sell-Price hint and overage as the value is typed (req D)', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1004',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Demo Hospital/ })
      fireEvent.click(screen.getByRole('tab', { name: 'Invoicing' }))
      await screen.findByText('No documents.')
      fireEvent.click(await screen.findByRole('button', { name: /Add document/ }))

      const valueInput = screen.getByLabelText('Document value')

      // 1004 Sell_Price is 39500; typing 10000 leaves 29500 remaining.
      fireEvent.change(valueInput, { target: { value: '10000' } })
      expect(
        await screen.findByText(/Remaining to Sell Price: €29,500\.00/),
      ).toBeInTheDocument()

      // Typing 50000 pushes past the cap → overage hint replaces the remaining hint.
      fireEvent.change(valueInput, { target: { value: '50000' } })
      expect(
        await screen.findByText(/Exceeds Sell Price by €10,500\.00/),
      ).toBeInTheDocument()
    })
  })

  describe('mutation cache synchronization (task #11)', () => {
    it('updates a recognition row in the cache from the mutation result', async () => {
      // 1001 is historical; admin is required to surface the per-row edit button
      // and to bypass the canEditFinancial month-lock.
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'admin',
      })
      await screen.findByText('€35,000.00')

      fireEvent.click(screen.getByRole('button', { name: /^Edit recognition row 1$/ }))
      fireEvent.change(screen.getByLabelText('Recognition value'), {
        target: { value: '9000' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      // The returned row replaces id 1 in the recognition list cache, so the new
      // value renders without a refetch. Edit mode also exits (no "Save").
      expect(await screen.findByText('€9,000.00')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    })

    it('removes a recognition row from the cache optimistically on delete', async () => {
      // 1001 is historical; admin is required to see the per-row delete button.
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'admin',
      })
      await screen.findByText('€35,000.00')
      expect(
        screen.getByRole('button', { name: /^Delete recognition row 1$/ }),
      ).toBeInTheDocument()

      // Trash fires the mutation directly (no in-app confirm dialog) so the
      // optimistic delete lands in the same render.
      fireEvent.click(screen.getByRole('button', { name: /^Delete recognition row 1$/ }))

      // The delete hook removes the row optimistically (onMutate) and does NOT
      // invalidate the recognition subtable, so id 1's actions vanish in the same
      // render — proving the cache was updated from the mutation, not a refetch.
      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: /^Edit recognition row 1$/ }),
        ).not.toBeInTheDocument()
      })
      expect(
        screen.queryByRole('button', { name: /^Delete recognition row 1$/ }),
      ).not.toBeInTheDocument()
    })

    it('removes a documento row from the cache optimistically on delete', async () => {
      // 1001 is historical; admin is required to see the per-row delete button.
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'admin',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      fireEvent.click(screen.getByRole('tab', { name: 'Invoicing' }))
      expect(await screen.findByText('FT 2025/0001')).toBeInTheDocument()

      // Trash fires the mutation directly (no in-app confirm dialog) so the
      // optimistic delete lands in the same render.
      fireEvent.click(screen.getByRole('button', { name: /^Delete document row 1$/ }))

      // Optimistic removal from the invoicing cache — the document number
      // disappears without waiting for a refetch.
      await waitFor(() => {
        expect(screen.queryByText('FT 2025/0001')).not.toBeInTheDocument()
      })
    })
  })

  describe('faturação status badge (derived from net invoiced)', () => {
    it('shows "Invoicedo Partialmente" for a partially invoiced order (1001)', async () => {
      renderWithProviders(<OrderDetailPage />, { initialPath: '/orders/1001', routePath: '/orders/:id' })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      fireEvent.click(screen.getByRole('tab', { name: 'Invoicing' }))
      // 1001: net 29250 < Sell_Price 48500 → partial.
      expect(await screen.findByText('Partially Invoiced')).toBeInTheDocument()
    })

    it('shows "Not Invoiced" for an order with no invoicing documents (1007)', async () => {
      renderWithProviders(<OrderDetailPage />, { initialPath: '/orders/1007', routePath: '/orders/:id' })
      await screen.findByRole('heading', { name: /Maintenance Co/ })
      fireEvent.click(screen.getByRole('tab', { name: 'Invoicing' }))
      expect(await screen.findByText('Not Invoiced')).toBeInTheDocument()
    })
  })

  describe('recognition type options by warranty (req: Warranty=0 hides W/WP)', () => {
    it('hides Warranty/Warranty Partial recognition types on a non-warranty order (1007, CM)', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1007',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Maintenance Co/ })
      fireEvent.click(screen.getByRole('button', { name: 'Add Recognition' }))
      const typeSelect = screen.getByLabelText('Recognition type') as HTMLSelectElement
      const optionValues = Array.from(typeSelect.options).map((o) => o.value)
      expect(optionValues).not.toContain('W')
      expect(optionValues).not.toContain('WP')
      expect(optionValues).toContain('CM')
    })
  })

  describe('Kit tab + Kit_Consumables sub-table (WS2/WS3)', () => {
    it('shows a Kit tab only for kit orders (1005 yes, 1001 no)', async () => {
      const { unmount } = renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1005',
        routePath: '/orders/:id',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      expect(screen.getByRole('tab', { name: 'Kit' })).toBeInTheDocument()
      unmount()

      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      expect(screen.queryByRole('tab', { name: 'Kit' })).not.toBeInTheDocument()
    })

    it('shows the Kit checkbox in caracterização (Yes for a kit order)', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1005',
        routePath: '/orders/:id',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      // The caracterização Kit row renders the flag as Yes/No in view mode.
      const kitLabel = screen.getByText('Kit', { selector: 'span' })
      expect(kitLabel.closest('div')).toHaveTextContent('Yes')
    })

    it('computes Balance = Kit Amount − Σ Total_Price on the Kit tab (1005 → 8 500)', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1005',
        routePath: '/orders/:id',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      fireEvent.click(screen.getByRole('tab', { name: 'Kit' }))
      // Kit_Amount 9750 − (250 + 1000) = 8500. Consumido = 1250.
      expect(await screen.findByText('€8,500.00')).toBeInTheDocument()
      expect(screen.getByText('€1,250.00')).toBeInTheDocument()
      expect(screen.getByText('€9,750.00')).toBeInTheDocument() // Kit Amount
    })

    it('lets an editor add a kit consumable and refresh the Balance', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1005',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      fireEvent.click(screen.getByRole('tab', { name: 'Kit' }))
      await screen.findByText('€8,500.00')

      fireEvent.click(screen.getByRole('button', { name: /Add Consumable/ }))
      fireEvent.change(screen.getByLabelText('Internal order'), { target: { value: 'INT-NEW' } })
      fireEvent.change(screen.getByLabelText('Material'), { target: { value: 'MAT-NEW-ADD' } })
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'desc' } })
      fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } })
      fireEvent.change(screen.getByLabelText('Unit price'), { target: { value: '100' } })
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))

      // The new row appears (unique material) and the Balance recomputes:
      // 9750 − (1250 + 200) = 8300.
      expect(await screen.findByText('MAT-NEW-ADD')).toBeInTheDocument()
      expect(await screen.findByText('€8,300.00')).toBeInTheDocument()
    })

    it('blocks adding a kit consumable that would exceed Kit_Amount (req G3)', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1005',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      fireEvent.click(screen.getByRole('tab', { name: 'Kit' }))
      await screen.findByText('€8,500.00')

      // 1005: Kit_Amount = 9750, existing consumed = 1250 → 8500 remaining.
      fireEvent.click(screen.getByRole('button', { name: /Add Consumable/ }))
      fireEvent.change(screen.getByLabelText('Internal order'), { target: { value: 'INT-X' } })
      fireEvent.change(screen.getByLabelText('Material'), { target: { value: 'MAT-X' } })
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'desc' } })
      fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '1' } })
      // 9000 + 1250 = 10250 > 9750 → cap check fires.
      fireEvent.change(screen.getByLabelText('Unit price'), { target: { value: '9000' } })
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))

      expect(
        await screen.findByText(/Kit amount would be exceeded/i),
      ).toBeInTheDocument()
      // The new row must not have been added.
      expect(screen.queryByText('MAT-X')).not.toBeInTheDocument()
      // Balance is unchanged: 9750 − 1250 = 8500.
      expect(screen.getByText('€8,500.00')).toBeInTheDocument()
    })

    it('lets an editor delete a kit consumable directly from the row', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1005',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      fireEvent.click(screen.getByRole('tab', { name: 'Kit' }))
      await screen.findByText('€8,500.00')

      // Trash fires the mutation directly (no in-app confirm dialog) so the
      // row vanishes and the Balance recomputes: 9750 − 1000 = 8750.
      fireEvent.click(screen.getByRole('button', { name: /^Delete kit consumable 1$/ }))

      // Row 1 vanishes and the Balance recomputes: 9750 − 1000 = 8750.
      await waitFor(() => {
        expect(screen.queryByText('MAT-FILTER')).not.toBeInTheDocument()
      })
      expect(await screen.findByText('€8,750.00')).toBeInTheDocument()
    })

    it('falls back to Revenue when Kit is disabled while the Kit tab is active', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1005',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      fireEvent.click(screen.getByRole('tab', { name: 'Kit' }))
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

      const kitCheckbox = screen.getByRole('checkbox', { name: 'Kit' })
      expect(kitCheckbox).toBeChecked()
      expect(kitCheckbox).not.toBeDisabled()
      fireEvent.click(kitCheckbox)
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => {
        expect(screen.queryByRole('tab', { name: 'Kit' })).not.toBeInTheDocument()
      })
      expect(screen.getByRole('tab', { name: 'Revenue' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
    })

    it('hides the Add Consumable button for a viewer', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1005',
        routePath: '/orders/:id',
        initialRole: 'viewer',
      })
      await screen.findByRole('heading', { name: /Client Alpha/ })
      fireEvent.click(screen.getByRole('tab', { name: 'Kit' }))
      await screen.findByText('€8,500.00')
      expect(screen.queryByRole('button', { name: /Add Consumable/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Delete kit consumable/ })).not.toBeInTheDocument()
    })
  })

  describe('financial month-lock (recognitions + invoicing documents)', () => {
    it('lets an editor still Add a recognition on a histórico order but blocks edit/delete of existing rows', async () => {
      // 1001 is a past-month (Sept 2025) non-Provisória order. "Today" is Aug 2026.
      // Rule: adding new rows is always allowed (any non-viewer); only editing or
      // deleting EXISTING rows is admin-only after the month has closed.
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByText('€35,000.00') // wait for recognitions to load

      // Adding stays open: the "Add Recognition" button is present and so is the
      // Propagate contract button (the contract for 1007 only — 1001 has no CM).
      expect(screen.getByRole('button', { name: 'Add Recognition' })).toBeInTheDocument()

      // But per-row edit/delete are gone and a "Locked" hint takes the cell.
      expect(
        screen.queryByRole('button', { name: /^Edit recognition row/ }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /^Delete recognition row/ }),
      ).not.toBeInTheDocument()
      expect(screen.getAllByLabelText('Field locked (month closed)').length).toBeGreaterThan(0)

      // Opening the add form and trying to type must still work for the editor.
      fireEvent.click(screen.getByRole('button', { name: 'Add Recognition' }))
      expect(screen.getByLabelText('Recognition value')).not.toBeDisabled()
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      // Invoicing documents: Add stays open, per-row edit/delete are locked.
      fireEvent.click(screen.getByRole('tab', { name: 'Invoicing' }))
      expect(screen.getByRole('button', { name: /Add document/ })).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /^Edit document row/ }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /^Delete document row/ }),
      ).not.toBeInTheDocument()
    })

    it('unlocks Add Recognition / Add documento + per-row actions for an admin on the same histórico order', async () => {
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1001',
        routePath: '/orders/:id',
        initialRole: 'admin',
      })
      await screen.findByText('€35,000.00')

      // Admin keeps full control: the Add button + per-row edit/delete are all present.
      expect(screen.getByRole('button', { name: 'Add Recognition' })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /^Edit recognition row 1$/ }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /^Delete recognition row 1$/ }),
      ).toBeInTheDocument()

      fireEvent.click(screen.getByRole('tab', { name: 'Invoicing' }))
      expect(screen.getByRole('button', { name: /Add document/ })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /^Edit document row 1$/ }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /^Delete document row 1$/ }),
      ).toBeInTheDocument()
    })

    it('keeps the Add Recognition / Add documento enabled for an editor on a Provisória order (current rule)', async () => {
      // 1002 is Provisória=true so the financial lock does not engage, and the
      // existing "Add Recognition" / "Add documento" buttons remain available.
      renderWithProviders(<OrderDetailPage />, {
        initialPath: '/orders/1002',
        routePath: '/orders/:id',
        initialRole: 'editor',
      })
      await screen.findByRole('heading', { name: /Client Beta/ })

      expect(screen.getByRole('button', { name: 'Add Recognition' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('tab', { name: 'Invoicing' }))
      // The document-type list loads asynchronously (~80ms mock latency); wait
      // for the "Add document" button to render rather than asserting it
      // synchronously.
      expect(await screen.findByRole('button', { name: /Add document/ })).toBeInTheDocument()
    })
  })
})
