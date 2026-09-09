import { describe, expect, it } from 'vitest'
import { formatAuditEntry, normalizeAuditLog } from '@/domain/audit'

describe('formatAuditEntry', () => {
  it('separates audit fields with semicolons and no arrow notation', () => {
    const entry = formatAuditEntry('Ana', {
      field: 'Sell Price',
      action: 'Updated',
      before: 10,
      after: 20,
    })

    expect(entry.split(';')).toHaveLength(6)
    expect(entry).not.toContain('->')
    expect(entry).not.toMatch(/^\[/)
    expect(entry).toContain(';Ana;Sell price;Updated;')
  })
})

describe('normalizeAuditLog', () => {
  it('converts existing legacy entries and leaves semicolon entries unchanged', () => {
    const legacy = '[29/08/26, 10:00:00]Ana-Sell price-Updated-€10.00->€20.00'
    const current = '29/08/26, 10:01:00;Luis;Client;Added;—;Acme'

    expect(normalizeAuditLog(`${legacy}\n${current}`)).toBe(
      '29/08/26, 10:00:00;Ana;Sell price;Updated;€10.00;€20.00\n' + current,
    )
  })
})
