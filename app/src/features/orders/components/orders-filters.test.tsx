import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  OrdersFilters,
  toSearchFilters,
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
    expect(toSearchFilters({ ...base, clientName: '   ' }).clientName).toBeNull()
    expect(toSearchFilters({ ...base, idTpOrder: ['COM'] }).idTpOrder).toEqual(['COM'])
  })
})

describe('OrdersFilters (cascade: Area → Product → Instrument)', () => {
  // Helper: open a dropdown by its button label, returning the popover panel.
  async function openDropdown(user: ReturnType<typeof userEvent.setup>, label: string) {
    await user.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }))
    // The popover panel is a `role="group"` labelled by the button.
    return await screen.findByRole('group')
  }

  it('shows the full Product list when no Area is selected', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <OrdersFilters value={empty} onChange={() => {}} />,
    )

    const panel = await openDropdown(user, 'Product')
    // The list is fetched through the mock repository (~80ms latency). Wait
    // for the first option to render before asserting the rest of the list.
    await within(panel).findByLabelText('MIR')
    // The full fixture has both BOPT (MIR, NIR, …) and BDAL (LAB GC, …) produtos.
    expect(within(panel).getByLabelText('MIR')).toBeInTheDocument()
    expect(within(panel).getByLabelText('LAB GC / SQ-MS Service')).toBeInTheDocument()
  })

  it('narrows the Product list to the selected Area (BDAL) and labels the dropdown', async () => {
    const user = userEvent.setup()
    function Harness() {
      // Local state so the test can drive the cascade from the rendered bar.
      const [value, setValue] = useState<OrdersFiltersValue>(empty)
      return <OrdersFilters value={value} onChange={setValue} />
    }
    renderWithProviders(<Harness />)

    // Pick the BDAL area.
    const areaPanel = await openDropdown(user, 'Area')
    await user.click(within(areaPanel).getByLabelText('BDAL'))

    // The Product dropdown button is now labelled "Product (in BDAL)" so the
    // user can see the cascade is active; the panel only shows BDAL products.
    const productButton = screen.getByRole('button', { name: /^Product \(in BDAL\)/ })
    await user.click(productButton)
    const productPanel = await screen.findByRole('group')
    await within(productPanel).findByLabelText('LAB GC / SQ-MS Service')
    expect(within(productPanel).getByLabelText('LAB GC / SQ-MS Service')).toBeInTheDocument()
    expect(within(productPanel).queryByLabelText('MIR')).not.toBeInTheDocument() // MIR is BOPT
  })

  it('narrows the Instrument list to the selected Product and labels the dropdown', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [value, setValue] = useState<OrdersFiltersValue>(empty)
      return <OrdersFilters value={value} onChange={setValue} />
    }
    renderWithProviders(<Harness />)

    // First pick a Product; the cascade routes through Area only because the
    // filter accepts multiple products at once, so we need an area too if we
    // want to see the "Instrument (in product N)" label. Pick BDAL, then
    // product 10 (Maldi-TOF), which has UltrafleXtreme + AutoFlex TOF/TOF.
    const areaPanel = await openDropdown(user, 'Area')
    await user.click(within(areaPanel).getByLabelText('BDAL'))

    const productPanel = await openDropdown(user, 'Product')
    // Wait for the product list to render before clicking.
    await within(productPanel).findByLabelText('Maldi-TOF')
    await user.click(within(productPanel).getByLabelText('Maldi-TOF'))

    // The Instrument dropdown is now scoped to that product.
    const instrumentButton = screen.getByRole('button', { name: /^Instrument \(in product 10\)/ })
    await user.click(instrumentButton)
    const instrumentPanel = await screen.findByRole('group')
    await within(instrumentPanel).findByLabelText('UltrafleXtreme')
    expect(within(instrumentPanel).getByLabelText('UltrafleXtreme')).toBeInTheDocument()
    expect(within(instrumentPanel).getByLabelText('AutoFlex TOF/TOF')).toBeInTheDocument()
    expect(within(instrumentPanel).queryByLabelText('VERTEX 70')).not.toBeInTheDocument() // VERTEX is product 1
  })
})