import { PageHeader } from '@/components/ui/page-header'

/**
 * Placeholder for features not yet built (Clients, Invoicing, Recognition,
 * Stock, Reports, Administration, New Order). Keeps routing complete so the
 * sidebar links resolve; each is replaced by its real feature in a later slice.
 */
export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="rounded-lg border border-dashed border-border p-8 text-sm text-foreground/60">
        This screen is part of a later phase of the migration roadmap.
      </div>
    </div>
  )
}