import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserProvider } from '@/app/providers/user-provider'
import { RepositoryProvider } from '@/app/providers/repository-provider'
import type { Role } from '@/domain/models/user'

interface ProviderOptions {
  initialRole?: Role
  initialPath?: string
  /** Route path to mount the UI under. Defaults to `*` (catch-all) for backward compat. */
  routePath?: string
}

/**
 * Wraps a node in the same provider stack the app uses (Query, User, Repository)
 * plus an in-memory router. Tests drive the Orders feature end-to-end through
 * the real (mock) repository and TanStack Query — no manager mocking.
 */
export function renderWithProviders(
  ui: ReactElement,
  { initialRole, initialPath = '/', routePath = '*' }: ProviderOptions = {},
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <UserProvider initialRole={initialRole}>{children}</UserProvider>
      </QueryClientProvider>
    )
  }

  const user = userEvent.setup()

  const result = render(
    <RepositoryProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path={routePath} element={ui} />
        </Routes>
      </MemoryRouter>
    </RepositoryProvider>,
    { wrapper: Wrapper, ...options },
  )

  return { ...result, user }
}