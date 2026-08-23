import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/components/ui/cn'

export interface TabItem {
  id: string
  label: string
  content: ReactNode
}

interface TabsProps {
  tabs: TabItem[]
  /** Initially active tab id; defaults to the first tab. */
  defaultTab?: string
  /** Accessible label for the tablist. */
  ariaLabel?: string
  className?: string
}

/**
 * Accessible tabs (WAI-ARIA tablist pattern).
 *
 * - Roving tabindex: only the active tab is in the tab order.
 * - Arrow Left/Right move between tabs (wrapping); Home/End jump to ends.
 * - The active panel is rendered alone and labelled by its tab.
 */
export function Tabs({ tabs, defaultTab, ariaLabel, className }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id ?? '')
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === active))
  const activeTab = tabs[activeIndex]

  function focusTab(id: string) {
    setActive(id)
    tabRefs.current[id]?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const count = tabs.length
    if (count === 0) return
    let nextIndex: number | null = null
    if (e.key === 'ArrowRight') nextIndex = (activeIndex + 1) % count
    else if (e.key === 'ArrowLeft') nextIndex = (activeIndex - 1 + count) % count
    else if (e.key === 'Home') nextIndex = 0
    else if (e.key === 'End') nextIndex = count - 1
    if (nextIndex !== null) {
      e.preventDefault()
      focusTab(tabs[nextIndex].id)
    }
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex flex-wrap gap-1 border-b border-border"
        onKeyDown={onKeyDown}
      >
        {tabs.map((t) => {
          const selected = t.id === active
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el
              }}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                selected
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-foreground/60 hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <div
        role="tabpanel"
        id={`panel-${activeTab?.id}`}
        aria-labelledby={`tab-${activeTab?.id}`}
        tabIndex={0}
        className="pt-4 focus-visible:outline-none"
      >
        {activeTab?.content}
      </div>
    </div>
  )
}