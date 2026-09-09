import type { QueryClient } from '@tanstack/react-query'

/** Revalidates views derived from an order after a financial mutation. */
export function invalidateOrderAggregate(queryClient: QueryClient, orderId: number): void {
  void queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] })
  void queryClient.invalidateQueries({ queryKey: ['orders', 'list'] })
  void queryClient.invalidateQueries({ queryKey: ['invoicing'] })
  void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  void queryClient.invalidateQueries({ queryKey: ['recognition-report'] })
  void queryClient.invalidateQueries({ queryKey: ['reports'] })
}
