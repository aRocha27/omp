import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { UserProvider } from '@/app/providers/user-provider'
import type { Role } from '@/domain/models/user'
import { AdminRoute } from './admin-route'

describe('AdminRoute', () => {
  it('redirects non-admin users away from Administration', () => {
    renderRoute('viewer')
    expect(screen.getByText('Home')).toBeVisible()
    expect(screen.queryByText('Sensitive administration')).not.toBeInTheDocument()
  })

  it('renders Administration for admins', () => {
    renderRoute('admin')
    expect(screen.getByText('Sensitive administration')).toBeVisible()
  })
})

function renderRoute(role: Role) {
  return render(
    <UserProvider initialRole={role}>
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/" element={<div>Home</div>} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <div>Sensitive administration</div>
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </UserProvider>,
  )
}
