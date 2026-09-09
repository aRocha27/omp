import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render-with-providers'
import { CompanySettings } from './company-settings'

const company = {
  Nome: 'Orders Portugal',
  Morada: 'Rua Principal, 10',
  Localidade: 'Lisboa',
  Codigo_Postal_Num: '1000-001',
  Telefone: '+351 210 000 000',
  Mail: 'orders@example.test',
  Site: 'https://orders.example.test',
  Contribuinte: 'PT123456789',
}

afterEach(() => vi.unstubAllGlobals())

describe('CompanySettings', () => {
  it('loads and displays every identification field, then refreshes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ ok: true, columns: Object.keys(company), rows: [company] }))
      .mockResolvedValueOnce(Response.json({ ok: true, columns: Object.keys(company), rows: [{ ...company, Nome: 'Updated Orders' }] }))
    vi.stubGlobal('fetch', fetchMock)

    const { user } = renderWithProviders(<CompanySettings />, { initialRole: 'admin' })

    expect(await screen.findByText('Orders Portugal')).toBeVisible()
    expect(screen.getByText('Rua Principal, 10')).toBeVisible()
    expect(screen.getByText('Lisboa')).toBeVisible()
    expect(screen.getByText('1000-001')).toBeVisible()
    expect(screen.getByText('+351 210 000 000')).toBeVisible()
    expect(screen.getByText('orders@example.test')).toBeVisible()
    expect(screen.getByText('https://orders.example.test')).toBeVisible()
    expect(screen.getByText('PT123456789')).toBeVisible()

    await user.click(screen.getByRole('button', { name: /refresh/i }))
    expect(await screen.findByText('Updated Orders')).toBeVisible()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows empty and error states', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ ok: true, columns: [], rows: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const { user } = renderWithProviders(<CompanySettings />)

    expect(await screen.findByText('No company identification record was returned.')).toBeVisible()

    fetchMock.mockRejectedValueOnce(new Error('Service unavailable'))
    await user.click(screen.getByRole('button', { name: /refresh/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t reach the database service'))
  })
})
