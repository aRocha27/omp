import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'

// Deal closed = done (green); open deal is still in progress, not a failure, so
// yellow ("warning") reads as "active/pending" rather than a broken state.
export function DealStatusBadge({ closed }: { closed: boolean | null }): ReactNode {
  if (closed == null) return '—'
  return closed ? <Badge tone="success">Closed</Badge> : <Badge tone="warning">Open</Badge>
}

// Invoicing is a required step: an uninvoiced order is a missing obligation,
// so red ("danger") signals "not done / action needed".
export function InvoicedBadge({ invoiced }: { invoiced: boolean | null }): ReactNode {
  if (invoiced == null) return '—'
  return invoiced ? <Badge tone="success">Invoiced</Badge> : <Badge tone="danger">Not invoiced</Badge>
}

// Recognition is an upstream/finance step that typically lags invoicing — not
// yet recognized is an expected waiting state, so yellow ("warning") fits.
export function RecognizedBadge({ recognized }: { recognized: boolean | null }): ReactNode {
  if (recognized == null) return '—'
  return recognized ? (
    <Badge tone="success">Recognized</Badge>
  ) : (
    <Badge tone="warning">Pending</Badge>
  )
}