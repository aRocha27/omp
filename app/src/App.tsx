import { RouterProvider } from 'react-router-dom'
import { QueryProvider } from '@/app/providers/query-provider'
import { UserProvider } from '@/app/providers/user-provider'
import { RepositoryProvider } from '@/app/providers/repository-provider'
import { router } from '@/app/router'
import { IntroSplash } from '@/components/layout/intro-splash'

export function App() {
  return (
    <QueryProvider>
      <UserProvider>
        <RepositoryProvider>
          <RouterProvider router={router} />
          <IntroSplash />
        </RepositoryProvider>
      </UserProvider>
    </QueryProvider>
  )
}