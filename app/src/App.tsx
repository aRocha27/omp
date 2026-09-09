import { RouterProvider } from 'react-router-dom'
import { QueryProvider } from '@/app/providers/query-provider'
import { UserProvider, useAuth } from '@/app/providers/user-provider'
import { RepositoryProvider } from '@/app/providers/repository-provider'
import { router } from '@/app/router'
import { LoginPage } from '@/features/auth/login-page'
import { WelcomeOverlay } from '@/components/layout/welcome-overlay'

export function App() {
  return (
    <QueryProvider>
      <UserProvider>
        <AuthenticatedApp />
      </UserProvider>
    </QueryProvider>
  )
}

function AuthenticatedApp() { const { user, loading } = useAuth(); if (loading) return <div className="flex h-full items-center justify-center bg-background text-sm text-foreground-muted">A carregar...</div>; if (!user) return <LoginPage />; return <RepositoryProvider><RouterProvider router={router} /><WelcomeOverlay /></RepositoryProvider> }
