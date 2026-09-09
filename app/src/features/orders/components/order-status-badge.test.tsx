import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  DealStatusBadge,
  InvoicedBadge,
  RecognizedBadge,
} from '@/features/orders/components/order-status-badge'

// Badge tones map to text color classes (see components/ui/badge.tsx).
const TONE_CLASS = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
} as const

function badgeWithTone(toneClass: string): HTMLElement | undefined {
  return document.querySelector(`[class*="${toneClass}"]`) ?? undefined
}

describe('DealStatusBadge', () => {
  it('renders success "Closed" when closed=true', () => {
    const { container } = render(<DealStatusBadge closed={true} />)
    expect(screen.getByText('Closed')).toBeTruthy()
    expect(badgeWithTone(TONE_CLASS.success)).toBeTruthy()
    expect(container.textContent).toBe('Closed')
  })

  it('renders warning "Open" when closed=false', () => {
    const { container } = render(<DealStatusBadge closed={false} />)
    expect(screen.getByText('Open')).toBeTruthy()
    expect(badgeWithTone(TONE_CLASS.warning)).toBeTruthy()
    expect(container.textContent).toBe('Open')
  })

  it('renders an em-dash and no badge when closed=null', () => {
    const { container } = render(<DealStatusBadge closed={null} />)
    expect(container.textContent).toBe('—')
    expect(badgeWithTone(TONE_CLASS.success)).toBeUndefined()
    expect(badgeWithTone(TONE_CLASS.warning)).toBeUndefined()
    expect(badgeWithTone(TONE_CLASS.danger)).toBeUndefined()
  })
})

describe('InvoicedBadge', () => {
  it('renders success "Invoiced" when invoiced=true', () => {
    const { container } = render(<InvoicedBadge invoiced={true} />)
    expect(screen.getByText('Invoiced')).toBeTruthy()
    expect(badgeWithTone(TONE_CLASS.success)).toBeTruthy()
    expect(container.textContent).toBe('Invoiced')
  })

  it('renders danger "Not invoiced" when invoiced=false', () => {
    const { container } = render(<InvoicedBadge invoiced={false} />)
    expect(screen.getByText('Not invoiced')).toBeTruthy()
    expect(badgeWithTone(TONE_CLASS.danger)).toBeTruthy()
    expect(container.textContent).toBe('Not invoiced')
  })

  it('renders an em-dash and no badge when invoiced=null', () => {
    const { container } = render(<InvoicedBadge invoiced={null} />)
    expect(container.textContent).toBe('—')
    expect(badgeWithTone(TONE_CLASS.success)).toBeUndefined()
    expect(badgeWithTone(TONE_CLASS.warning)).toBeUndefined()
    expect(badgeWithTone(TONE_CLASS.danger)).toBeUndefined()
  })
})

describe('RecognizedBadge', () => {
  it('renders success "Recognized" when recognized=true', () => {
    const { container } = render(<RecognizedBadge recognized={true} />)
    expect(screen.getByText('Recognized')).toBeTruthy()
    expect(badgeWithTone(TONE_CLASS.success)).toBeTruthy()
    expect(container.textContent).toBe('Recognized')
  })

  it('renders warning "Pending" when recognized=false', () => {
    const { container } = render(<RecognizedBadge recognized={false} />)
    expect(screen.getByText('Pending')).toBeTruthy()
    expect(badgeWithTone(TONE_CLASS.warning)).toBeTruthy()
    expect(container.textContent).toBe('Pending')
  })

  it('renders an em-dash and no badge when recognized=null', () => {
    const { container } = render(<RecognizedBadge recognized={null} />)
    expect(container.textContent).toBe('—')
    expect(badgeWithTone(TONE_CLASS.success)).toBeUndefined()
    expect(badgeWithTone(TONE_CLASS.warning)).toBeUndefined()
    expect(badgeWithTone(TONE_CLASS.danger)).toBeUndefined()
  })
})