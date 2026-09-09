import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useRepositories } from '@/app/providers/repository-provider'
import { normaliseOrderFilters, type OrderSearchFilters, type OrderSortId } from '@/domain/models/order'

const PAGE_SIZE = 500

/**
 * Fetches the order list through the active `OrdersRepository`.
 *
 * Filters are normalised before being passed to the repository so empty
 * strings/undefined never reach the data layer (MOCK_DATA_CONTRACT §4). The
 * repository returns the complete matching list; the query key includes the
 * normalised filters so cached results remain stable.
 */
export function useOrders(filters: OrderSearchFilters, sort: { id: OrderSortId; desc: boolean }) {
  const { orders } = useRepositories()
  const normalised = normaliseOrderFilters(filters)

  const query = useInfiniteQuery({
    queryKey: ['orders', 'list', normalised, sort],
    initialPageParam: { offset: 0, cursor: undefined as string | undefined },
    queryFn: ({ pageParam }) =>
      orders.searchPage(normalised, {
        limit: PAGE_SIZE,
        offset: pageParam.offset,
        cursor: pageParam.cursor,
        sort: { id: sort.id, direction: sort.desc ? 'desc' : 'asc' },
      }),
    placeholderData: keepPreviousData,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.nextCursor) return undefined
      return {
        offset: allPages.reduce((sum, page) => sum + page.items.length, 0),
        cursor: lastPage.nextCursor,
      }
    },
  })

  return {
    ...query,
    data: query.isPlaceholderData ? [] : query.data?.pages.flatMap((page) => page.items) ?? [],
    total: query.isPlaceholderData ? 0 : query.data?.pages[0]?.total ?? 0,
  }
}

export function useOrderFacets(filters: OrderSearchFilters) {
  const { orders } = useRepositories()
  const normalised = normaliseOrderFilters(filters)
  return useQuery({
    queryKey: ['orders', 'facets', normalised],
    queryFn: () => orders.facets(normalised),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })
}
