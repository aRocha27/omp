import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { createRepositories, type Repositories } from '@/services'

/**
 * Provides the selected repository set to the app.
 *
 * The concrete implementation is chosen by `DATA_MODE` in `services/index.ts`;
 * UI code consumes the `Repositories` interface and is unaware of mock vs HTTP.
 */
const RepositoryContext = createContext<Repositories | null>(null)

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const repositories = useMemo(() => createRepositories(), [])
  return <RepositoryContext value={repositories}>{children}</RepositoryContext>
}

export function useRepositories(): Repositories {
  const ctx = useContext(RepositoryContext)
  if (!ctx) throw new Error('useRepositories must be used within <RepositoryProvider>')
  return ctx
}