import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DatePicker } from '@/components/ui/date-picker'

/**
 * The DatePicker is a text input that displays `dd/mm/yyyy` and emits ISO
 * `YYYY-MM-DD` to the parent. The text format is fixed regardless of the
 * host's locale, so a workstation set to en-US still shows the business
 * locale (pt-PT) used by every read-only date in the app.
 */

describe('DatePicker', () => {
  it('renders a text input with the given aria-label', () => {
    render(<DatePicker aria-label="Order date" value={null} onChange={() => {}} />)
    const input = screen.getByLabelText('Order date') as HTMLInputElement
    expect(input).toBeInTheDocument()
    expect(input.type).toBe('text')
    expect(screen.getByRole('button', { name: 'Open calendar for Order date' })).toBeInTheDocument()
  })

  it('renders a hidden native date input for the popup picker', () => {
    const { container } = render(
      <DatePicker aria-label="Order date" value="2026-08-26" onChange={() => {}} />,
    )
    const nativeInput = container.querySelector('input[type="date"]') as HTMLInputElement | null
    expect(nativeInput).not.toBeNull()
    expect(nativeInput?.value).toBe('2026-08-26')
  })

  it('shows the ISO value as dd/mm/yyyy', () => {
    render(<DatePicker aria-label="Order date" value="2026-08-26" onChange={() => {}} />)
    expect(screen.getByLabelText('Order date')).toHaveValue('26/08/2026')
  })

  it('renders an empty input when value is null', () => {
    render(<DatePicker aria-label="Order date" value={null} onChange={() => {}} />)
    expect(screen.getByLabelText('Order date')).toHaveValue('')
  })

  it('emits the ISO string when the user types a valid dd/mm/yyyy', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DatePicker aria-label="Order date" value={null} onChange={onChange} />)

    await user.type(screen.getByLabelText('Order date'), '15/04/2030')

    expect(onChange).toHaveBeenLastCalledWith('2030-04-15')
  })

  it('does not commit a partial / invalid keystroke', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DatePicker aria-label="Order date" value={null} onChange={onChange} />)

    const input = screen.getByLabelText('Order date')
    await user.type(input, '1/')

    // Still typing — the input keeps the text on screen but no onChange fires.
    expect(input).toHaveValue('1/')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not commit a real date when the user only typed a single digit per part', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DatePicker aria-label="Order date" value={null} onChange={onChange} />)

    // `1/2/2026` is ambiguous (Jan 2 vs Feb 1) and the user only typed one
    // digit per part. The picker should NOT commit; it should keep the text.
    const input = screen.getByLabelText('Order date')
    await user.type(input, '1/2/2026')
    expect(input).toHaveValue('1/2/2026')
    expect(onChange).not.toHaveBeenCalled()

    // After the user fixes it to the unambiguous form, the ISO is committed.
    await user.clear(input)
    await user.type(input, '15/04/2030')
    expect(onChange).toHaveBeenLastCalledWith('2030-04-15')
  })

  it('emits null when the user clears the input', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DatePicker aria-label="Order date" value="2026-08-26" onChange={onChange} />)

    await user.clear(screen.getByLabelText('Order date'))

    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('emits the ISO string when the popup calendar picks a date', () => {
    const onChange = vi.fn()
    const { container } = render(
      <DatePicker aria-label="Order date" value={null} onChange={onChange} />,
    )
    const nativeInput = container.querySelector('input[type="date"]') as HTMLInputElement

    fireEvent.change(nativeInput, { target: { value: '2030-04-15' } })

    expect(onChange).toHaveBeenLastCalledWith('2030-04-15')
    expect(screen.getByLabelText('Order date')).toHaveValue('15/04/2030')
  })

  it('opens the native popup picker when the calendar button is clicked', async () => {
    const user = userEvent.setup()
    const showPicker = vi.fn()
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      configurable: true,
      value: showPicker,
    })

    render(<DatePicker aria-label="Order date" value={null} onChange={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Open calendar for Order date' }))

    expect(showPicker).toHaveBeenCalledTimes(1)
  })

  it('re-syncs the displayed text when the parent value changes externally', () => {
    const { rerender } = render(
      <DatePicker aria-label="Order date" value="2026-08-26" onChange={() => {}} />,
    )
    expect(screen.getByLabelText('Order date')).toHaveValue('26/08/2026')

    rerender(<DatePicker aria-label="Order date" value={null} onChange={() => {}} />)
    expect(screen.getByLabelText('Order date')).toHaveValue('')

    rerender(<DatePicker aria-label="Order date" value="2027-01-05" onChange={() => {}} />)
    expect(screen.getByLabelText('Order date')).toHaveValue('05/01/2027')
  })

  it('renders disabled when disabled prop is passed', () => {
    render(<DatePicker aria-label="Order date" value={null} onChange={() => {}} disabled />)
    expect(screen.getByLabelText('Order date')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Open calendar for Order date' })).toBeDisabled()
  })
})
