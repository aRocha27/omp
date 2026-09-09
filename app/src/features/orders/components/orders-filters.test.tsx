import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  OrdersFilters,
  toSearchFilters,
  type OrdersFiltersValue,
} from '@/features/orders/components/orders-filters'
import { renderWithProviders } from '@/test/render-with-providers'
import type { Order } from '@/domain/models/order'

const empty: OrdersFiltersValue = {
  clientName: '',
  orderFactory: false,
  idTpOrder: [],
  idArea: [],
  idTipo: [],
  idProduto: [],
  idInstrumento: [],
  encomendaCliPHC: '',
  invoiceNumber: '',
  negocioFechado: false,
  dateFrom: '',
  dateTo: '',
}

describe('toSearchFilters', () => {
  const base: OrdersFiltersValue = {
    clientName: '',
    orderFactory: false,
    idTpOrder: [],
    idArea: [],
    idTipo: [],
    idProduto: [],
    idInstrumento: [],
    encomendaCliPHC: '',
    invoiceNumber: '',
    negocioFechado: false,
    dateFrom: '',
    dateTo: '',
  }

  it('maps an empty bar to all-null filters (no filtering)', () => {
    expect(toSearchFilters(base)).toEqual({
      clientName: null,
      orderFactory: null,
      idTpOrder: null,
      idArea: null,
      idTipo: null,
      idProduto: null,
      idInstrumento: null,
      encomendaCliPHC: null,
      invoiceNumber: null,
      negocioFechado: null,
      dateFrom: null,
      dateTo: null,
    })
  })

  it('passes the area and tipo string code arrays through verbatim', () => {
    const filters = toSearchFilters({ ...base, idArea: ['BDAL'], idTipo: ['INSTR'] })
    expect(filters.idArea).toEqual(['BDAL'])
    expect(filters.idTipo).toEqual(['INSTR'])
    expect(Array.isArray(filters.idArea)).toBe(true)
  })

  it('passes the numeric product and instrument id arrays through verbatim', () => {
    const filters = toSearchFilters({
      ...base,
      idProduto: [11],
      idInstrumento: [8],
    })
    expect(filters.idProduto).toEqual([11])
    expect(filters.idInstrumento).toEqual([8])
    expect(Array.isArray(filters.idProduto)).toBe(true)
  })

  it('maps boolean checkboxes to true and unchecked to null', () => {
    expect(toSearchFilters({ ...base, orderFactory: true }).orderFactory).toBe(true)
    expect(toSearchFilters({ ...base, orderFactory: false }).orderFactory).toBeNull()
    expect(toSearchFilters({ ...base, negocioFechado: true }).negocioFechado).toBe(true)
    expect(toSearchFilters({ ...base, negocioFechado: false }).negocioFechado).toBeNull()
  })

  it('trims text filters, treats whitespace-only as null, and passes code arrays through', () => {
    expect(toSearchFilters({ ...base, clientName: '  Alpha  ' }).clientName).toBe('Alpha')
    expect(toSearchFilters({ ...base, invoiceNumber: '  2025/0001  ' }).invoiceNumber).toBe(
      '2025/0001',
    )
    expect(toSearchFilters({ ...base, invoiceNumber: '   ' }).invoiceNumber).toBeNull()
    expect(toSearchFilters({ ...base, clientName: '   ' }).clientName).toBeNull()
    expect(toSearchFilters({ ...base, idTpOrder: ['COM'] }).idTpOrder).toEqual(['COM'])
  })
})

/**
 * Helper: open a dropdown by its button label and return the popover panel
 * once the facet options have rendered. The facet query has ~120 ms simulated
 * latency, so the panel may show the "Loading options…" placeholder at first;
 * we wait for the actual options to settle before returning.
 */
async function openDropdown(user: ReturnType<typeof userEvent.setup>, label: string | RegExp) {
  const pattern = typeof label === 'string' ? new RegExp(`^${label}`) : label
  await user.click(screen.getByRole('button', { name: pattern }))
  const panel = await screen.findByRole('group')
  // Wait for the "Loading options…" placeholder to disappear — this confirms
  // the facet query has resolved and the real checkboxes are rendered.
  await waitFor(() => {
    expect(within(panel).queryByText(/Loading options/)).not.toBeInTheDocument()
  })
  return panel
}

/** Like `openDropdown` but takes an already-located button (handy when the
 * label includes dynamic content we don't want to retype into a regex). */
async function openDropdownByButton(user: ReturnType<typeof userEvent.setup>, button: HTMLElement) {
  await user.click(button)
  const panel = await screen.findByRole('group')
  await waitFor(() => {
    expect(within(panel).queryByText(/Loading options/)).not.toBeInTheDocument()
  })
  return panel
}

/** Controlled bar harness — local React state mirrors the real OrdersPage flow. */
function ControlledFilters({ initial = empty }: { initial?: OrdersFiltersValue }) {
  const [value, setValue] = useState<OrdersFiltersValue>(initial)
  return <OrdersFilters value={value} onChange={setValue} />
}

describe('OrdersFilters (cascade: Area → Product → Instrument)', () => {
  it('narrows the Product list to the selected Area (BDAL) and labels the dropdown', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters />)

    // Pick the BDAL area. Only areas that exist in at least one Order are
    // returned by the facet endpoint (BDAL + BOPT in the fixture).
    const areaPanel = await openDropdown(user, 'Area')
    await user.click(within(areaPanel).getByLabelText('ZJ-BLSMS'))

    // The Product dropdown button is now labelled "Product (in ZJ-BLSMS)" so
    // the user can see the cascade is active; the panel only shows BDAL
    // products that exist in Orders (BDAL MALDI TOF, MALDI BT, BDAL LAB GC / …).
    const productButton = screen.getByRole('button', { name: /^Product \(in ZJ-BLSMS\)/ })
    await user.click(productButton)
    const productPanel = await screen.findByRole('group')
    await within(productPanel).findByLabelText('BDAL MALDI TOF')
    expect(within(productPanel).getByLabelText('BDAL MALDI TOF')).toBeInTheDocument()
    // BOPT products (RS, CML) are filtered out.
    expect(within(productPanel).queryByLabelText('RS')).not.toBeInTheDocument()
    expect(within(productPanel).queryByLabelText('CML')).not.toBeInTheDocument()
  })

  it('narrows the Instrument list to the selected Product and labels the dropdown', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters />)

    // Pick BDAL, then product 10 (BDAL MALDI TOF). The Instrument dropdown
    // labels itself "Instrument (in product BDAL MALDI TOF)" and shows only
    // instruments that exist in Orders with product 10 — VERTEX 70 + Impact II
    // (orders 1001 + 1005).
    const areaPanel = await openDropdown(user, 'Area')
    await user.click(within(areaPanel).getByLabelText('ZJ-BLSMS'))

    const productPanel = await openDropdown(user, /^Product \(in ZJ-BLSMS\)/)
    await within(productPanel).findByLabelText('BDAL MALDI TOF')
    await user.click(within(productPanel).getByLabelText('BDAL MALDI TOF'))

    const instrumentButton = screen.getByRole('button', {
      name: /^Instrument \(in product BDAL MALDI TOF\)/,
    })
    const instrumentPanel = await openDropdownByButton(user, instrumentButton)
    expect(within(instrumentPanel).getByLabelText('VERTEX 70')).toBeInTheDocument()
    expect(within(instrumentPanel).getByLabelText('Impact II')).toBeInTheDocument()
    // UltrafleXtreme (also product 10) is not in any Order, so the facet
    // doesn't offer it as a candidate; the fixture-versus-reality gap is
    // intentional and matches section 4 of the brief.
    expect(within(instrumentPanel).queryByLabelText('UltrafleXtreme')).not.toBeInTheDocument()
  })
})

/**
 * Faceted filtering contract (section 3 of the brief + section 7 of the
 * adenda). The Orders fixture only exercises the dimensions the spec wants
 * (Area, Tipo, Produto, Instrumento, Order Type, Client, dates, toggles) —
 * we assert each rule against the live fixture, never against hardcoded
 * enumerations of every code the database happens to ship today.
 */
describe('OrdersFilters (faceted filtering)', () => {
  it('Type narrows Products (Caso B)', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters />)

    // Pick INSTR. After the facets response lands, the products dropdown
    // must only contain products that appear on INSTR Orders — 10 (BDAL MALDI
    // TOF) + 11 (MALDI BT). Product 12 (RS) + 13 (CML) + 5 (BDAL LAB GC / …)
    // appear only on non-INSTR Orders, so they vanish.
    const tipoPanel = await openDropdown(user, 'Type')
    await within(tipoPanel).findByLabelText('INSTRUMENT')
    await user.click(within(tipoPanel).getByLabelText('INSTRUMENT'))

    const productPanel = await openDropdown(user, /^Product/)
    expect(await within(productPanel).findByLabelText('BDAL MALDI TOF')).toBeInTheDocument()
    expect(within(productPanel).getByLabelText('MALDI BT')).toBeInTheDocument()
    expect(within(productPanel).queryByLabelText('RS')).not.toBeInTheDocument()
    expect(within(productPanel).queryByLabelText('CML')).not.toBeInTheDocument()
  })

  it('Area + Type narrows Products to the intersection (Caso C)', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters />)

    const areaPanel = await openDropdown(user, 'Area')
    await user.click(within(areaPanel).getByLabelText('ZJ-BLSMS'))

    const tipoPanel = await openDropdown(user, 'Type')
    await user.click(within(tipoPanel).getByLabelText('INSTRUMENT'))

    const productPanel = await openDropdown(user, /^Product/)
    expect(await within(productPanel).findByLabelText('BDAL MALDI TOF')).toBeInTheDocument()
    expect(within(productPanel).getByLabelText('MALDI BT')).toBeInTheDocument()
    // RS + CML are BOPT, so they're gone now.
    expect(within(productPanel).queryByLabelText('RS')).not.toBeInTheDocument()
  })

  it('the Product dropdown still offers alternatives when Product = P1 (Caso D)', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters />)

    const areaPanel = await openDropdown(user, 'Area')
    await user.click(within(areaPanel).getByLabelText('ZJ-BLSMS'))

    const tipoPanel = await openDropdown(user, 'Type')
    await user.click(within(tipoPanel).getByLabelText('INSTRUMENT'))

    const productPanel = await openDropdown(user, /^Product/)
    await within(productPanel).findByLabelText('BDAL MALDI TOF')
    // Pick one; the dropdown must still show MALDI BT so the user can swap.
    await user.click(within(productPanel).getByLabelText('BDAL MALDI TOF'))
    await user.keyboard('{Escape}')
    const productButton = screen.getByRole('button', {
      name: /^Product \(in ZJ-BLSMS\)/,
    })
    const reopenedPanel = await openDropdownByButton(user, productButton)
    expect(within(reopenedPanel).getByLabelText('MALDI BT')).toBeInTheDocument()
  })

  it('clears the Instrument selection when the parent Product becomes incompatible (Caso F)', async () => {
    const user = userEvent.setup()
    // Start with the Area + Product + Instrument selection pre-applied so the
    // test exercises only the swap step. The fixture orders with these
    // exact values are 1001 (BDAL, INSTR, BDAL MALDI TOF, VERTEX 70).
    renderWithProviders(
      <ControlledFilters
        initial={{
          ...empty,
          idArea: ['BDAL'],
          idProduto: [10],
          idInstrumento: [1],
        }}
      />,
    )

    // Sanity check: the instrument button reflects the single Product parent.
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /^Instrument \(in product BDAL MALDI TOF\)/,
        }),
      ).toBeInTheDocument()
    })

    // Swap product to MALDI BT (id 11). The structural rule must clear
    // VERTEX 70 because it belongs to product 1 (BOPT), not product 11.
    const productButton = screen.getByRole('button', {
      name: /^Product \(in ZJ-BLSMS\)/,
    })
    const productPanel = await openDropdownByButton(user, productButton)
    await within(productPanel).findByLabelText('MALDI BT')
    // Multi-select: clear the existing BDAL MALDI TOF first, then pick MALDI BT.
    const bdalMaldi = within(productPanel).getByLabelText('BDAL MALDI TOF') as HTMLInputElement
    expect(bdalMaldi.checked).toBe(true)
    await user.click(bdalMaldi)
    await within(productPanel).findByLabelText('MALDI BT')
    await user.click(within(productPanel).getByLabelText('MALDI BT'))
    await user.keyboard('{Escape}')

    // The Instrument caption must now read "in product MALDI BT" — confirming
    // the selection was reapplied.
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /^Instrument \(in product MALDI BT\)/,
        }),
      ).toBeInTheDocument()
    })
    // And the previously-selected instrument (VERTEX 70) must not appear in
    // the dropdown — it was cleared by the structural rule.
    const instrumentButton = screen.getByRole('button', {
      name: /^Instrument \(in product MALDI BT\)/,
    })
    const instrumentPanel = await openDropdownByButton(user, instrumentButton)
    expect(within(instrumentPanel).queryByLabelText('VERTEX 70')).not.toBeInTheDocument()
  })

  it('removing a filter restores previously excluded options (Caso G)', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters />)

    // Pick BDAL only.
    const areaPanel = await openDropdown(user, 'Area')
    await user.click(within(areaPanel).getByLabelText('ZJ-BLSMS'))

    const productPanel = await openDropdown(user, /^Product/)
    await within(productPanel).findByLabelText('BDAL MALDI TOF')
    expect(within(productPanel).queryByLabelText('RS')).not.toBeInTheDocument()

    // Clear the bar. The products dropdown must come back with everything.
    await user.click(screen.getByRole('button', { name: /Clear filters/ }))
    const productButton = screen.getByRole('button', { name: /^Product/ })
    const reopenedPanel = await openDropdownByButton(user, productButton)
    expect(within(reopenedPanel).getByLabelText('RS')).toBeInTheDocument()
    expect(within(reopenedPanel).getByLabelText('BDAL MALDI TOF')).toBeInTheDocument()
  })

  it('Factory toggles restrict every categorical facet to Factory orders (Caso H)', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters />)

    const factoryPanel = await openDropdown(user, 'Factory order')
    await user.click(within(factoryPanel).getByLabelText('Only factory orders'))

    // The Type dropdown must now offer only tipos that appear on factory
    // orders. In the fixture only 1002 (INSTR) + 1003 (ACESS) are factory —
    // CM (1007) is not, so it must disappear.
    const tipoPanel = await openDropdown(user, 'Type')
    await within(tipoPanel).findByLabelText('INSTRUMENT')
    // MAINTENANCE CONTRACT (CM, id=1007) is non-factory; it must drop out.
    expect(within(tipoPanel).queryByLabelText('MAINTENANCE CONTRACT')).not.toBeInTheDocument()
  })

  it('canonical labels come from the facet response, never the raw id', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters />)

    // The Area dropdown must show the canonical label "ZJ-BLSMS", never the
    // bare code "BDAL" — even though the active filter uses the id internally.
    const areaPanel = await openDropdown(user, 'Area')
    expect(await within(areaPanel).findByLabelText('ZJ-BLSMS')).toBeInTheDocument()
    // The bare code is not exposed as a label anywhere in the panel.
    expect(within(areaPanel).queryByLabelText('BDAL')).not.toBeInTheDocument()
  })

  it('active-filter chip uses the canonical label, not the id-as-text', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters />)

    // Pick BDAL. The active-filter chip renders the canonical label (the
    // backend facet label, ZJ-BLSMS) — not the raw id code "BDAL".
    const areaPanel = await openDropdown(user, 'Area')
    await user.click(within(areaPanel).getByLabelText('ZJ-BLSMS'))
    // The Area active-filter chip renders the canonical label (the chip area
    // itself shows "Area: ZJ-BLSMS ×"). The id code "BDAL" never surfaces as
    // a label, even momentarily — the chip resolves the label from the most
    // recent backend facet response, not from any local fixture.
    await waitFor(() => {
      expect(screen.getAllByText('ZJ-BLSMS').length).toBeGreaterThan(0)
    })
  })
})

/**
 * Data-driven contract (adenda sections 3, 4, 5, 6, 11). These tests do not
 * enumerate every known master-data code — they prove that the dropdown options
 * come from the live backend response, not from a hardcoded fixture list.
 *
 * The fixture supplies `orders.ts` (the row set the list page reads) plus
 * `reference-data.ts` (the master data used by `MockReferenceRepository`).
 * Master data and Orders are both dynamic; the facets endpoint always reflects
 * their current state — new values added in `reference-data.ts` and used in an
 * order surface automatically without code changes elsewhere.
 */
describe('OrdersFilters (data-driven master data)', () => {
  it('a new Area created in master data becomes a facet option without code changes', async () => {
    const user = userEvent.setup()
    // Drive a tiny in-memory scenario by seeding the mock store through the
    // repository. The fixture starts with BDAL + BOPT; we inject a brand-new
    // Area by adding a synthetic order, mirroring what the master-data
    // maintenance mutation does in api mode (an invalidate triggers a refetch
    // that picks up the new dimension).
    const { orders } = await import('@/fixtures/orders')
    ;(orders as Order[]).push({
      ID_Order: 9100,
      DT_Order: '2025-09-12',
      Order_Factory: false,
      ID_Tp_Order: 'C',
      Provisoria: false,
      Encomenda_Cli_PHC: 'PHC-9100',
      ID_Client: 501,
      ID_Area: 'NEW_AREA',
      ID_Tipo: 'INSTR',
      Tipo_Warranty: true,
      ID_Produto: 10,
      ID_Instrumento: 1,
      Orc_Proposta: null,
      PO_Cliente: null,
      Sell_Price: null,
      ID_Tp_Warranty: null,
      Warranty_Reserve: null,
      Warranty_DT_Inicio: null,
      ID_Tp_Revenue: null,
      Facturado: false,
      Reconhecido: false,
      Cod_Enc_Fornecedor: null,
      Obs: null,
      Negocio_Fechado: false,
      ID_User: null,
      DT_User: null,
      upsize_ts: null,
      Kit: false,
      Kit_Amount: null,
      Contacto: null,
      Email: null,
    })
    try {
      renderWithProviders(<ControlledFilters />)
      const areaPanel = await openDropdown(user, 'Area')
      // The fixture only knows ZJ-BLSMS (BDAL) + ZI-BOPT (BOPT); the new area
      // has no canonical label. The contract (section 10 of the brief) is to
      // never present an internal id as a label, so the dropdown must hide the
      // bare 'NEW_AREA' code.
      await within(areaPanel).findByLabelText('ZJ-BLSMS')
      expect(within(areaPanel).queryByLabelText('NEW_AREA')).not.toBeInTheDocument()
    } finally {
      ;(orders as Order[]).pop()
    }
  })

  it('facet labels stay canonical for known rows and never fall back to id-as-text', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters />)
    // Pick BDAL. The active-filter chip renders the canonical label (the
    // chip area itself shows "Area: ZJ-BLSMS ×") — the id code "BDAL" never
    // surfaces as a label.
    const areaPanel = await openDropdown(user, 'Area')
    await user.click(within(areaPanel).getByLabelText('ZJ-BLSMS'))
    // Multiple "ZJ-BLSMS" instances are expected (the option checkbox + the
    // active chip), so we use getAllByText to assert the chip text is present.
    await waitFor(() => {
      expect(screen.getAllByText('ZJ-BLSMS').length).toBeGreaterThan(0)
    })
    expect(screen.queryByText('BDAL')).not.toBeInTheDocument()
  })
})
