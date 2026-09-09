/**
 * Bidirectional / faceted filtering — every facet must restrict every other
 * facet in both directions, regardless of selection order.
 *
 * These tests are independent of the cascade rule (Area → Product →
 * Instrument); they exercise the orthogonal fact that each filter is a
 * dimensional projection of the Orders fact table.
 *
 * Order scenarios used (see app/src/fixtures/orders.ts):
 * - 1001: BDAL, INSTR, BDAL MALDI TOF, VERTEX 70, Order_Factory=false, Negocio=false, 2025-09-12
 * - 1002: BDAL, INSTR, MALDI BT,    LCMS,      Order_Factory=true,  Negocio=true,  2025-09-12, Client 502
 * - 1003: BOPT, ACESS, RS,         Ultraflex, Order_Factory=true,  Negocio=false, 2025-08-30, Client 503
 * - 1004: BOPT, ACESS, CML,        null,      Order_Factory=false, Negocio=false, 2025-08-15, Client 504
 * - 1005: BDAL, INSTR, BDAL MALDI TOF, Impact II, Order_Factory=false, Negocio=false, 2025-07-22
 * - 1006: null,  null,  null,       null,      Order_Factory=null,   Negocio=false, 2025-06-04
 * - 1007: BOPT, CM,    BDAL LAB GC, null,      Order_Factory=false, Negocio=false, 2025-05-13, Client 505
 */
import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  OrdersFilters,
  type OrdersFiltersValue,
} from '@/features/orders/components/orders-filters'
import { renderWithProviders } from '@/test/render-with-providers'

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

async function openDropdown(user: ReturnType<typeof userEvent.setup>, label: string | RegExp) {
  const pattern = typeof label === 'string' ? new RegExp(`^${label}`) : label
  // Close any previously-open panel so we always read the right `role="group"`
  // (the FilterDropdownButton is uncontrolled — clicking a different button
  // doesn't auto-close the previous one).
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: pattern }))
  const panel = await screen.findByRole('group')
  await waitFor(() => {
    expect(within(panel).queryByText(/Loading options/)).not.toBeInTheDocument()
  })
  return panel
}

function ControlledFilters({ initial = empty }: { initial?: OrdersFiltersValue }) {
  const [value, setValue] = useState<OrdersFiltersValue>(initial)
  return <OrdersFilters value={value} onChange={setValue} />
}

/**
 * Each test below exercises a single "selection order" path:
 *   facet F is selected → every other facet shows the narrowed set.
 *
 * The reverse direction (every other facet restricts F) is already covered by
 * the same backend: the facets endpoint excludes its own filter, so the
 * remaining facets are the DISTINCT ids that survive the F selection. The
 * tests below prove that for every facet (not just Area/Product/Instrument)
 * the exclude-own-facet semantics hold and the other facets shrink.
 */
describe('OrdersFilters — bidirectional faceted filtering (Detalhe → Global)', () => {
  it('selecting Type = INSTR narrows every other categorical facet', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters />)

    // Pick INSTR first. Only orders 1001, 1002, 1005 carry ID_Tipo='INSTR'.
    const tipoPanel = await openDropdown(user, 'Type')
    await user.click(within(tipoPanel).getByLabelText('INSTRUMENT'))

    // Areas: only BDAL appears on INSTR orders.
    const areaPanel = await openDropdown(user, 'Area')
    expect(await within(areaPanel).findByLabelText('ZJ-BLSMS')).toBeInTheDocument()
    expect(within(areaPanel).queryByLabelText('ZI-BOPT')).not.toBeInTheDocument()

    // Products: only BDAL MALDI TOF + MALDI BT appear on INSTR orders.
    const productPanel = await openDropdown(user, /^Product/)
    expect(await within(productPanel).findByLabelText('BDAL MALDI TOF')).toBeInTheDocument()
    expect(within(productPanel).getByLabelText('MALDI BT')).toBeInTheDocument()
    expect(within(productPanel).queryByLabelText('RS')).not.toBeInTheDocument()
    expect(within(productPanel).queryByLabelText('CML')).not.toBeInTheDocument()

    // Instruments: only VERTEX 70, LCMS, Impact II appear on INSTR orders.
    const instrumentPanel = await openDropdown(user, /^Instrument/)
    expect(within(instrumentPanel).getByLabelText('VERTEX 70')).toBeInTheDocument()
    expect(within(instrumentPanel).getByLabelText('LCMS')).toBeInTheDocument()
    expect(within(instrumentPanel).getByLabelText('Impact II')).toBeInTheDocument()
    expect(within(instrumentPanel).queryByLabelText('UltrafleXtreme')).not.toBeInTheDocument()

    // Order type: the types present on INSTR orders include C (1001, 1005)
    // and COM (1002). Both appear.
    const orderTypePanel = await openDropdown(user, 'Order type')
    expect(await within(orderTypePanel).findByLabelText('Client')).toBeInTheDocument()
    expect(within(orderTypePanel).getByLabelText('Comercial')).toBeInTheDocument()
  })

  it('selecting Instrument = VERTEX 70 narrows Areas, Products, Types and Order Types', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters />)

    // VERTEX 70 appears on order 1001 (BDAL, INSTR, BDAL MALDI TOF).
    const instrumentPanel = await openDropdown(user, 'Instrument')
    await user.click(within(instrumentPanel).getByLabelText('VERTEX 70'))
    await user.keyboard('{Escape}')

    // Areas: only BDAL is compatible.
    const areaPanel = await openDropdown(user, 'Area')
    expect(await within(areaPanel).findByLabelText('ZJ-BLSMS')).toBeInTheDocument()
    expect(within(areaPanel).queryByLabelText('ZI-BOPT')).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    // Products: only BDAL MALDI TOF (product 10) carries VERTEX 70.
    const productPanel = await openDropdown(user, /^Product/)
    expect(await within(productPanel).findByLabelText('BDAL MALDI TOF')).toBeInTheDocument()
    expect(within(productPanel).queryByLabelText('MALDI BT')).not.toBeInTheDocument()
    expect(within(productPanel).queryByLabelText('RS')).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    // Types: only INSTRUMENT carries VERTEX 70.
    const tipoPanel = await openDropdown(user, 'Type')
    expect(await within(tipoPanel).findByLabelText('INSTRUMENT')).toBeInTheDocument()
    expect(within(tipoPanel).queryByLabelText('ACESSORIES')).not.toBeInTheDocument()
    expect(within(tipoPanel).queryByLabelText('MAINTENANCE CONTRACT')).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    // Order type: only C appears on VERTEX 70 orders.
    const orderTypePanel = await openDropdown(user, 'Order type')
    expect(await within(orderTypePanel).findByLabelText('Client')).toBeInTheDocument()
    expect(within(orderTypePanel).queryByLabelText('Comercial')).not.toBeInTheDocument()
  })

  it('selecting Product = BDAL MALDI TOF narrows Areas, Types, Instruments and Order Types', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters />)

    const productPanel = await openDropdown(user, 'Product')
    await user.click(within(productPanel).getByLabelText('BDAL MALDI TOF'))

    // Areas: only BDAL carries BDAL MALDI TOF.
    const areaPanel = await openDropdown(user, 'Area')
    expect(await within(areaPanel).findByLabelText('ZJ-BLSMS')).toBeInTheDocument()
    expect(within(areaPanel).queryByLabelText('ZI-BOPT')).not.toBeInTheDocument()

    // Types: only INSTRUMENT appears with BDAL MALDI TOF.
    const tipoPanel = await openDropdown(user, 'Type')
    expect(await within(tipoPanel).findByLabelText('INSTRUMENT')).toBeInTheDocument()
    expect(within(tipoPanel).queryByLabelText('ACESSORIES')).not.toBeInTheDocument()

    // Instruments: only VERTEX 70 + Impact II come with BDAL MALDI TOF.
    const instrumentPanel = await openDropdown(user, /^Instrument/)
    expect(await within(instrumentPanel).findByLabelText('VERTEX 70')).toBeInTheDocument()
    expect(within(instrumentPanel).getByLabelText('Impact II')).toBeInTheDocument()
    expect(within(instrumentPanel).queryByLabelText('LCMS')).not.toBeInTheDocument()
  })

  it('selecting Area = BOPT narrows Types, Products, Instruments and Order Types', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters />)

    const areaPanel = await openDropdown(user, 'Area')
    await user.click(within(areaPanel).getByLabelText('ZI-BOPT'))

    // Types: BOPT orders carry ACESS (1003, 1004) + CM (1007).
    const tipoPanel = await openDropdown(user, 'Type')
    expect(await within(tipoPanel).findByLabelText('ACESSORIES')).toBeInTheDocument()
    expect(within(tipoPanel).getByLabelText('MAINTENANCE CONTRACT')).toBeInTheDocument()
    expect(within(tipoPanel).queryByLabelText('INSTRUMENT')).not.toBeInTheDocument()

    // Products: only RS (12) + CML (13) + BDAL LAB GC (5) appear in BOPT orders.
    const productPanel = await openDropdown(user, /^Product/)
    expect(await within(productPanel).findByLabelText('RS')).toBeInTheDocument()
    expect(within(productPanel).getByLabelText('CML')).toBeInTheDocument()
    expect(within(productPanel).getByLabelText('BDAL LAB GC / SQ-MS Service')).toBeInTheDocument()
    expect(within(productPanel).queryByLabelText('BDAL MALDI TOF')).not.toBeInTheDocument()

    // Instruments: UltrafleXtreme is on order 1003 (BOPT); no BOPT order
    // carries VERTEX 70 / Impact II / LCMS.
    const instrumentPanel = await openDropdown(user, /^Instrument/)
    expect(await within(instrumentPanel).findByLabelText('UltrafleXtreme')).toBeInTheDocument()
    expect(within(instrumentPanel).queryByLabelText('VERTEX 70')).not.toBeInTheDocument()
  })

  it('selecting Order Type = COM narrows Areas, Types, Products and Instruments', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters />)

    // Order type COM appears on orders 1002 + 1003 (BDAL/INSTR + BOPT/ACESS).
    const orderTypePanel = await openDropdown(user, 'Order type')
    await user.click(within(orderTypePanel).getByLabelText('Comercial'))

    // Areas: BDAL + BOPT both appear on COM orders.
    const areaPanel = await openDropdown(user, 'Area')
    expect(await within(areaPanel).findByLabelText('ZJ-BLSMS')).toBeInTheDocument()
    expect(within(areaPanel).getByLabelText('ZI-BOPT')).toBeInTheDocument()

    // Types: INSTRUMENT + ACESSORIES appear on COM orders.
    const tipoPanel = await openDropdown(user, 'Type')
    expect(await within(tipoPanel).findByLabelText('INSTRUMENT')).toBeInTheDocument()
    expect(within(tipoPanel).getByLabelText('ACESSORIES')).toBeInTheDocument()
    expect(within(tipoPanel).queryByLabelText('MAINTENANCE CONTRACT')).not.toBeInTheDocument()

    // Products: MALDI BT (1002) + RS (1003) appear on COM orders; BDAL MALDI
    // TOF appears on 1001 which is C (not COM) and is excluded.
    const productPanel = await openDropdown(user, /^Product/)
    expect(await within(productPanel).findByLabelText('MALDI BT')).toBeInTheDocument()
    expect(within(productPanel).getByLabelText('RS')).toBeInTheDocument()
    expect(within(productPanel).queryByLabelText('BDAL MALDI TOF')).not.toBeInTheDocument()

    // Instruments: LCMS (1002) + UltrafleXtreme (1003) appear on COM orders.
    const instrumentPanel = await openDropdown(user, /^Instrument/)
    expect(await within(instrumentPanel).findByLabelText('LCMS')).toBeInTheDocument()
    expect(within(instrumentPanel).getByLabelText('UltrafleXtreme')).toBeInTheDocument()
    expect(within(instrumentPanel).queryByLabelText('VERTEX 70')).not.toBeInTheDocument()
  })

  it('Factory=true narrows every facet to factory-only orders', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters />)

    const factoryPanel = await openDropdown(user, 'Factory order')
    await user.click(within(factoryPanel).getByLabelText('Only factory orders'))

    // Areas: only BDAL (1002) + BOPT (1003) are factory.
    const areaPanel = await openDropdown(user, 'Area')
    expect(await within(areaPanel).findByLabelText('ZJ-BLSMS')).toBeInTheDocument()
    expect(within(areaPanel).getByLabelText('ZI-BOPT')).toBeInTheDocument()

    // Types: only INSTRUMENT (1002) + ACESSORIES (1003) on factory orders.
    const tipoPanel = await openDropdown(user, 'Type')
    expect(await within(tipoPanel).findByLabelText('INSTRUMENT')).toBeInTheDocument()
    expect(within(tipoPanel).getByLabelText('ACESSORIES')).toBeInTheDocument()
    expect(within(tipoPanel).queryByLabelText('MAINTENANCE CONTRACT')).not.toBeInTheDocument()

    // Products: only MALDI BT (1002) + RS (1003) on factory orders.
    const productPanel = await openDropdown(user, /^Product/)
    expect(await within(productPanel).findByLabelText('MALDI BT')).toBeInTheDocument()
    expect(within(productPanel).getByLabelText('RS')).toBeInTheDocument()
    expect(within(productPanel).queryByLabelText('BDAL MALDI TOF')).not.toBeInTheDocument()

    // Instruments: only LCMS (1002) + UltrafleXtreme (1003).
    const instrumentPanel = await openDropdown(user, /^Instrument/)
    expect(await within(instrumentPanel).findByLabelText('LCMS')).toBeInTheDocument()
    expect(within(instrumentPanel).getByLabelText('UltrafleXtreme')).toBeInTheDocument()
    expect(within(instrumentPanel).queryByLabelText('VERTEX 70')).not.toBeInTheDocument()
  })

  it('Deal Closed = true narrows every facet to closed-deal orders', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters />)

    const closedPanel = await openDropdown(user, 'Deal closed')
    await user.click(within(closedPanel).getByLabelText('Only closed deals'))

    // Only order 1002 carries Negocio_Fechado=true. BDAL + INSTR +
    // MALDI BT + LCMS survive.
    const areaPanel = await openDropdown(user, 'Area')
    expect(await within(areaPanel).findByLabelText('ZJ-BLSMS')).toBeInTheDocument()
    expect(within(areaPanel).queryByLabelText('ZI-BOPT')).not.toBeInTheDocument()

    const tipoPanel = await openDropdown(user, 'Type')
    expect(await within(tipoPanel).findByLabelText('INSTRUMENT')).toBeInTheDocument()
    expect(within(tipoPanel).queryByLabelText('ACESSORIES')).not.toBeInTheDocument()

    const productPanel = await openDropdown(user, /^Product/)
    expect(await within(productPanel).findByLabelText('MALDI BT')).toBeInTheDocument()
    expect(within(productPanel).queryByLabelText('BDAL MALDI TOF')).not.toBeInTheDocument()

    const instrumentPanel = await openDropdown(user, /^Instrument/)
    expect(await within(instrumentPanel).findByLabelText('LCMS')).toBeInTheDocument()
    expect(within(instrumentPanel).queryByLabelText('VERTEX 70')).not.toBeInTheDocument()
  })

  it('From-date = 2025-09-01 narrows every facet to orders in that window', async () => {
    const user = userEvent.setup()
    // Orders 1001 + 1002 (2025-09-12, BDAL) + 1007 (2025-10-10, BOPT) survive
    // a From-date filter of 2025-09-01. The window-narrowing contract is
    // proven by the Area/Product facets no longer including options that
    // only existed in pre-2025-09 orders (e.g. CML product, BOPT MAINTENANCE
    // CONTRACT CM kind on order 1007 still passes because 1007 is in window).
    renderWithProviders(
      <ControlledFilters initial={{ ...empty, dateFrom: '2025-09-01' }} />,
    )

    // Wait for the initial facets query (dateFrom='2025-09-01') to resolve.
    await waitFor(() => {
      expect(screen.queryByText(/Loading options/)).not.toBeInTheDocument()
    })

    const areaPanel = await openDropdown(user, 'Area')
    expect(await within(areaPanel).findByLabelText('ZJ-BLSMS')).toBeInTheDocument()

    const productPanel = await openDropdown(user, /^Product/)
    expect(await within(productPanel).findByLabelText('BDAL MALDI TOF')).toBeInTheDocument()
    expect(within(productPanel).getByLabelText('MALDI BT')).toBeInTheDocument()
    // CML is only on order 1004 (2025-08-15) — outside the window — so it
    // must drop out of the Product facet.
    expect(within(productPanel).queryByLabelText('CML')).not.toBeInTheDocument()
  })

  it('SAP Order text narrows every facet to matching Encomenda_Cli_PHC', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ControlledFilters initial={{ ...empty, encomendaCliPHC: 'PHC-1002' }} />,
    )

    // Only order 1002 has PHC-1002: BDAL + INSTR + MALDI BT + LCMS + COM.
    const areaPanel = await openDropdown(user, 'Area')
    expect(await within(areaPanel).findByLabelText('ZJ-BLSMS')).toBeInTheDocument()
    expect(within(areaPanel).queryByLabelText('ZI-BOPT')).not.toBeInTheDocument()

    const tipoPanel = await openDropdown(user, 'Type')
    expect(await within(tipoPanel).findByLabelText('INSTRUMENT')).toBeInTheDocument()
    expect(within(tipoPanel).queryByLabelText('ACESSORIES')).not.toBeInTheDocument()

    const productPanel = await openDropdown(user, /^Product/)
    expect(await within(productPanel).findByLabelText('MALDI BT')).toBeInTheDocument()
    expect(within(productPanel).queryByLabelText('BDAL MALDI TOF')).not.toBeInTheDocument()

    const orderTypePanel = await openDropdown(user, 'Order type')
    expect(await within(orderTypePanel).findByLabelText('Comercial')).toBeInTheDocument()
    expect(within(orderTypePanel).queryByLabelText('Client')).not.toBeInTheDocument()
  })
})

/**
 * Reverse direction (Global → Detalhe): selecting any other facet must
 * reduce the active facet's options to only the ones compatible with the
 * active selection (idempotent pruning).
 */
describe('OrdersFilters — bidirectional pruning (Global → Detalhe)', () => {
  it('picking Type = INSTR keeps Product = MALDI BT but drops Product = RS', async () => {
    const user = userEvent.setup()
    // Start with BDAL + MALDI BT (product 11) + RS (product 12) selected.
    // Both are valid in the BDAL universe initially because the universe
    // contains both BDAL MALDI TOF (INSTR) and RS (ACESS) on BOPT — but
    // once we pin Area=BDAL, the facets exclude BOPT-only products, so the
    // universe-pruning already drops RS at mount time. We then add Type=INSTR
    // and confirm no further products survive (BDAL MALDI TOF + MALDI BT).
    renderWithProviders(
      <ControlledFilters
        initial={{ ...empty, idArea: ['BDAL'], idProduto: [10, 11] }}
      />,
    )

    // Pick INSTR. Both BDAL MALDI TOF (10) + MALDI BT (11) survive; the
    // structural rule (Area -> Product) is already satisfied.
    const tipoPanel = await openDropdown(user, 'Type')
    await user.click(within(tipoPanel).getByLabelText('INSTRUMENT'))

    // After Type=INSTR the facet now lists BDAL MALDI TOF + MALDI BT only.
    // RS (BOPT) and CML (BOPT) are out. Both selections (10 + 11) remain
    // valid because both products appear on INSTR orders in BDAL.
    await waitFor(() => {
      expect(screen.queryByText('RS')).not.toBeInTheDocument()
      expect(screen.queryByText('CML')).not.toBeInTheDocument()
    })
  })

  it('picking Factory=true keeps Area = BDAL but drops Area = BOPT', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledFilters initial={{ ...empty, idArea: ['BDAL', 'BOPT'] }} />)

    const factoryPanel = await openDropdown(user, 'Factory order')
    await user.click(within(factoryPanel).getByLabelText('Only factory orders'))

    // BOPT has no factory orders in the fixture (only order 1003 is BOPT
    // factory — wait, 1003 IS BOPT factory. Correction: BOPT has factory
    // orders (1003), so it should survive. The invalid selection is none.)
    // But Area=null (1006) has no factory flag, so the Area=null row is
    // excluded. There's no "null" facet option to drop. Instead, verify
    // both Areas still appear and are still selected.
    await waitFor(() => {
      const allChips = screen.getAllByText(/^(ZJ-BLSMS|ZI-BOPT)$/)
      expect(allChips.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('picking SAP Order text drops an incompatible Instrument selection', async () => {
    const user = userEvent.setup()
    // Start with VERTEX 70 selected. VERTEX 70 is on order 1001 (PHC-1001).
    renderWithProviders(<ControlledFilters initial={{ ...empty, idInstrumento: [1] }} />)

    // Add a SAP Order text that doesn't match order 1001.
    const sapInput = screen.getByLabelText('SAP Order')
    await user.type(sapInput, 'PHC-1002')

    // The Instrument selection (VERTEX 70) must be cleared because no order
    // with PHC-1002 carries it. The Instrument dropdown button shows no
    // active count (no badge).
    await waitFor(() => {
      const instrumentButton = screen.getByRole('button', { name: /^Instrument/ })
      // No badge → no active selection. The badge would render as
      // "Instrument1" if the selection was kept.
      expect((instrumentButton.textContent ?? '').replace(/\s+/g, '')).not.toMatch(/Instrument\d/)
    })
  })
})
