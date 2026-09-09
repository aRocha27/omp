/**
 * Deterministic, synthetic Reconhecimento (revenue recognition) fixtures.
 *
 * MOCK DATA ONLY — never production facts (docs/context/MOCK_DATA_CONTRACT.md).
 * Identifiers are non-production; dates are ISO 8601 UTC strings (TIMEZONE.md).
 * Fixtures are deterministic: the same scenario always renders the same way.
 *
 * Keyed to the mock orders in `fixtures/orders.ts`:
 * - 1001 (Sell_Price 48 500): two Parcial (P) entries plus a Warranty (W) entry,
 *   so the Revenue tab's Instrument-vs-Warranty split is demonstrable. The
 *   36 455 total is intentionally below Sell_Price so "Por reconhecer" is positive.
 * - 1002 (Sell_Price 132 000, Reconhecido=true): a Total (T) instrument entry
 *   plus a Warranty Parcial (WP) entry that together cover the full Sell_Price.
 * - 1005 (Sell_Price 750 000): a single Total (T) entry below Sell_Price.
 */
import type { Reconhecimento } from '@/domain/models/reconhecimento'

export const reconhecimentos: readonly Reconhecimento[] = [
  {
    ID_Reconhecimento: 1,
    ID_Order: 1001,
    ID_Tp_Reconhecimento: 'P',
    DT_Reconhecimento: '2025-09-20T10:00:00Z',
    Valor_Reconhecimento: 15000,
    ID_User: 'u_demo_a',
    DT_User: '2025-09-20T10:00:00Z',
  },
  {
    ID_Reconhecimento: 2,
    ID_Order: 1001,
    // Warranty recognition — splits into the Warranty bucket, not Instrument.
    ID_Tp_Reconhecimento: 'W',
    DT_Reconhecimento: '2025-09-25T09:30:00Z',
    Valor_Reconhecimento: 1455,
    ID_User: 'u_demo_a',
    DT_User: '2025-09-25T09:30:00Z',
  },
  {
    ID_Reconhecimento: 3,
    ID_Order: 1001,
    ID_Tp_Reconhecimento: 'P',
    DT_Reconhecimento: '2025-10-10T14:15:00Z',
    Valor_Reconhecimento: 20000,
    ID_User: 'u_demo_a',
    DT_User: '2025-10-10T14:15:00Z',
  },
  {
    ID_Reconhecimento: 4,
    ID_Order: 1002,
    // Instrument revenue — the Total recognition of the equipment portion.
    ID_Tp_Reconhecimento: 'T',
    DT_Reconhecimento: '2025-09-15T11:00:00Z',
    Valor_Reconhecimento: 125400,
    ID_User: 'u_demo_b',
    DT_User: '2025-09-15T11:00:00Z',
  },
  {
    ID_Reconhecimento: 5,
    ID_Order: 1002,
    // Warranty Parcial — remaining warranty reserve, completes the full 132 000.
    ID_Tp_Reconhecimento: 'WP',
    DT_Reconhecimento: '2025-09-16T11:00:00Z',
    Valor_Reconhecimento: 6600,
    ID_User: 'u_demo_b',
    DT_User: '2025-09-16T11:00:00Z',
  },
  {
    ID_Reconhecimento: 6,
    ID_Order: 1005,
    // Partial Total on a high-value open order — leaves "Por reconhecer" positive.
    ID_Tp_Reconhecimento: 'T',
    DT_Reconhecimento: '2025-08-01T08:00:00Z',
    Valor_Reconhecimento: 500000,
    ID_User: 'u_demo_a',
    DT_User: '2025-08-01T08:00:00Z',
  },
  {
    ID_Reconhecimento: 7,
    ID_Order: 1005,
    ID_Tp_Reconhecimento: 'P',
    DT_Reconhecimento: '2025-08-20T16:45:00Z',
    Valor_Reconhecimento: 100000,
    ID_User: 'u_demo_a',
    DT_User: '2025-08-20T16:45:00Z',
  },
]