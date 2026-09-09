import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { OrderDetailPage } from '@/features/orders/components/order-detail-page'
import { renderWithProviders } from '@/test/render-with-providers'
import { MockReconhecimentoRepository } from '@/services/mock/reconhecimento.mock-repository'
import { MockDocumentoFaturacaoRepository } from '@/services/mock/documento-faturacao.mock-repository'

/**
 * The detail page used to swallow recognition/document load errors (only the
 * document-types error was surfaced). Task #11 surfaces each subtable's own
 * query error as an alert banner so a failed read is visible, not silent.
 *
 * The mock repositories are real instances created by RepositoryProvider; we
 * reject the list method on the prototype to simulate a failed read without
 * mocking the whole provider stack.
 */
describe('OrderDetailPage — subtable query errors', () => {
  afterEach(() => vi.restoreAllMocks())

  it('surfaces a recognition load error as an alert banner', async () => {
    vi.spyOn(MockReconhecimentoRepository.prototype, 'listByOrder').mockRejectedValue(
      new Error('Falha ao carregar reconhecimentos.'),
    )
    renderWithProviders(<OrderDetailPage />, {
      initialPath: '/orders/1001',
      routePath: '/orders/:id',
      initialRole: 'editor',
    })
    await screen.findByRole('heading', { name: /Client Alpha/ })
    // `alert` derives its accessible name from aria-label, not text, so assert the
    // role is present and carries the rejected message (not just any text match).
    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('Falha ao carregar reconhecimentos.')
  })

  it('surfaces a documents load error as an alert banner', async () => {
    vi.spyOn(MockDocumentoFaturacaoRepository.prototype, 'listByOrder').mockRejectedValue(
      new Error('Falha ao carregar documentos.'),
    )
    renderWithProviders(<OrderDetailPage />, {
      initialPath: '/orders/1001',
      routePath: '/orders/:id',
      initialRole: 'editor',
    })
    await screen.findByRole('heading', { name: /Client Alpha/ })
    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('Falha ao carregar documentos.')
  })
})
