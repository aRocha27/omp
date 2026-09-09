import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'

/**
 * Full-screen Paperfold splash shown on every app startup. Plays an intro video while
 * the app shell mounts underneath; the splash dismisses itself the moment the
 * video fires its `ended` event, or sooner if the viewer clicks Skip.
 *
 * The intro is rendered into a portal so it sits above the entire React tree
 * regardless of the route. It is *not* persisted: a reload, a tab restore, or a
 * fresh browser session always shows it again, matching the "every startup"
 * requirement.
 */
export function IntroSplash({
  videoSrc = '/paperfold-logo.svg',
}: {
  videoSrc?: string
}) {
  const [visible, setVisible] = useState(true)
  const dialogRef = useRef<HTMLDivElement>(null)

  const dismiss = useCallback(() => setVisible(false), [])

  // Focus the Skip button on mount so keyboard users land on the primary control.
  // Escape also dismisses (matches the standard "close this overlay" gesture).
  useEffect(() => {
    if (!visible) return
    const node = dialogRef.current
    if (!node) return
    const focusable = node.querySelector<HTMLElement>(buttonSelector)
    focusable?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        dismiss()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [visible, dismiss])

  if (!visible) return null

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
       aria-label="Paperfold intro"
      className="fixed inset-0 z-50 bg-foreground text-background"
    >
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={videoSrc}
        autoPlay
        muted
        playsInline
        onEnded={dismiss}
        onError={dismiss}
         aria-label="Paperfold intro video"
      />
      <div className="absolute bottom-6 right-6">
        <Button
          variant="secondary"
          size="sm"
          onClick={dismiss}
          aria-label="Skip intro"
          data-testid="intro-skip"
        >
          Skip
        </Button>
      </div>
    </div>,
    document.body,
  )
}

/** Selector that matches both `<button>` and `<a>` (we only render a button today,
 *  but the focus-management query should not silently skip anchor variants). */
const buttonSelector =
  'button:not([disabled]), [href]:not([aria-disabled="true"]), [tabindex]:not([tabindex="-1"])'
