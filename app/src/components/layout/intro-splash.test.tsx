import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IntroSplash } from '@/components/layout/intro-splash'

/** Helper: find the <video> inside the dialog so individual tests can dispatch
 *  media events without re-querying the tree. */
function getVideo(): HTMLVideoElement {
  const dialog = screen.getByRole('dialog', { name: /paperfold intro/i })
  const video = dialog.querySelector('video')
  if (!video) throw new Error('intro dialog has no <video>')
  return video as HTMLVideoElement
}

describe('IntroSplash', () => {
  it('renders a fullscreen dialog with the intro video and Skip button on mount', () => {
    render(<IntroSplash videoSrc="/test.mp4" />)

    const dialog = screen.getByRole('dialog', { name: /paperfold intro/i })
    expect(dialog).toBeInTheDocument()
    expect(getVideo()).toHaveAttribute('src', '/test.mp4')
    expect(screen.getByRole('button', { name: /skip intro/i })).toBeInTheDocument()
  })

  it('points at the bundled Paperfold logo by default', () => {
    render(<IntroSplash />)
    expect(getVideo().getAttribute('src')).toBe('/paperfold-logo.svg')
  })

  it('dismisses itself when the Skip button is clicked', () => {
    render(<IntroSplash />)
    expect(screen.getByRole('dialog', { name: /paperfold intro/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /skip intro/i }))

    expect(screen.queryByRole('dialog', { name: /paperfold intro/i })).not.toBeInTheDocument()
  })

  it('dismisses itself when the video fires its `ended` event', () => {
    render(<IntroSplash videoSrc="/test.mp4" />)
    expect(screen.getByRole('dialog', { name: /paperfold intro/i })).toBeInTheDocument()

    fireEvent(getVideo(), new Event('ended'))

    expect(screen.queryByRole('dialog', { name: /paperfold intro/i })).not.toBeInTheDocument()
  })

  it('dismisses itself when the video errors out (no asset on disk)', () => {
    render(<IntroSplash videoSrc="/missing.mp4" />)
    expect(screen.getByRole('dialog', { name: /paperfold intro/i })).toBeInTheDocument()

    fireEvent(getVideo(), new Event('error'))

    expect(screen.queryByRole('dialog', { name: /paperfold intro/i })).not.toBeInTheDocument()
  })

  it('dismisses on Escape', () => {
    render(<IntroSplash />)
    expect(screen.getByRole('dialog', { name: /paperfold intro/i })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: /paperfold intro/i })).not.toBeInTheDocument()
  })

  it('focuses the Skip button on mount for keyboard users', async () => {
    render(<IntroSplash />)
    const skip = screen.getByRole('button', { name: /skip intro/i })

    // The focus effect runs after paint; assert within a tick.
    await waitFor(() => expect(document.activeElement).toBe(skip))
  })
})
