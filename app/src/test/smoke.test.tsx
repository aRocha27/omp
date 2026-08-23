import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { App } from '@/App'

describe('App shell', () => {
  it('renders the sidebar brand and the dashboard route', () => {
    render(<App />)

    // Sidebar brand
    expect(screen.getByText(/orders platform/i)).toBeInTheDocument()

    // The dashboard is the index route and renders its own heading
    const main = screen.getByRole('main')
    expect(within(main).getByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
  })

  it('renders the demo role switcher', () => {
    render(<App />)
    expect(screen.getByRole('group', { name: /switch demo role/i })).toBeInTheDocument()
  })
})