export type AuditAction = 'Added' | 'Updated' | 'Removed'

export interface AuditChange {
  field: string
  action: AuditAction
  before?: unknown
  after?: unknown
}

export const AUDIT_FIELD_LABELS: Record<string, string> = {
  'Order Date': 'Order date',
  'Order Type': 'Order type',
  'SAP Order Number': 'SAP order number',
  Client: 'Client',
  Area: 'Area',
  Type: 'Type',
  Product: 'Product',
  Instrument: 'Instrument',
  Warranty: 'Warranty',
  'Warranty Start': 'Warranty start',
  'Revenue Type': 'Revenue type',
  'Sell Price': 'Sell price',
  'Warranty Reserve': 'Warranty reserve',
  'Quote / Proposal': 'Quote / proposal',
  'Customer PO': 'Customer PO',
  'Email do Pedido': 'Order email',
  'Customer Contact': 'Customer contact',
  Kit: 'Kit',
  'Kit Amount': 'Kit amount',
  Notes: 'Notes',
  DT_Doc_FT: 'Document date',
  ID_Tp_Doc_FT: 'Document type',
  N_Doc_FT: 'Document number',
  Valor_Doc_FT: 'Document value',
  Imprimiu: 'Printed',
  E_Invoice: 'E-invoice',
  Imp_Block: 'Block print',
  Nome_PDF: 'PDF filename',
}

export function formatAuditEntry(userName: string, change: AuditChange): string {
  const timestamp = new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date())
  const field = formatField(change.field)
  return `${timestamp};${userName};${field};${change.action};${formatValue(change.field, change.before)};${formatValue(change.field, change.after)}`
}

export function normalizeAuditLog(logs: string): string {
  return logs
    .split(/\r?\n/)
    .map((entry) => {
      if (!entry || entry.includes(';')) return entry

      const match = entry.match(/^\[([^\]]+)\](.*)-(Added|Updated|Removed)-(.+)->(.*)$/)
      if (!match) return entry

      const [, timestamp, actorAndField, action, before, after] = match
      const separator = actorAndField.indexOf('-')
      if (separator < 0) return entry

      const user = actorAndField.slice(0, separator)
      const field = actorAndField.slice(separator + 1)
      return `${timestamp};${user};${field};${action};${before};${after}`
    })
    .join('\n')
}

function formatField(field: string): string {
  const [record, property] = field.split('.')
  if (!property) return AUDIT_FIELD_LABELS[field] ?? field
  return `${record.replace('#', '#')}.${AUDIT_FIELD_LABELS[property] ?? property}`
}

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number' && /price|reserve|value|amount/i.test(field)) {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)
  }
  return String(value)
}
