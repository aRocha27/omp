/**
 * Deterministic, synthetic Facturacao (invoicing documents) fixtures.
 *
 * MOCK DATA ONLY — never production facts (docs/context/MOCK_DATA_CONTRACT.md).
 * Identifiers are non-production; dates are ISO 8601 UTC strings (TIMEZONE.md).
 * Fixtures are deterministic: the same scenario always renders the same way.
 *
 * Keyed to the mock orders in `fixtures/orders.ts`:
 * - 1001 (Sell_Price 48 500): an FT Factura plus an AcFT acerto, totalling 29 250
 *   (below Sell_Price, so the order is partially invoiced).
 * - 1002 (Sell_Price 132 000, Facturado=true): two FT Facturas covering the full
 *   value, followed by an NC Nota Crédito (negative) so the credit-note path is
 *   demonstrable. Net invoiced = 129 000.
 */
import type { DocumentoFaturacao } from '@/domain/models/documento-faturacao'

export const facturacao: readonly DocumentoFaturacao[] = [
  {
    ID_Facturacao: 1,
    ID_Order: 1001,
    ID_Tp_Doc_FT: 'FT',
    N_Doc_FT: 'FT 2025/0001',
    DT_Doc_FT: '2025-09-30T00:00:00Z',
    Valor_Doc_FT: 24250,
    ID_User: 'u_demo_a',
    DT_User: '2025-09-30T00:00:00Z',
  },
  {
    ID_Facturacao: 2,
    ID_Order: 1001,
    // Acerto Factura — a later adjustment on top of the original Factura.
    ID_Tp_Doc_FT: 'AcFT',
    N_Doc_FT: 'AcFT 2025/0002',
    DT_Doc_FT: '2025-10-15T00:00:00Z',
    Valor_Doc_FT: 5000,
    ID_User: 'u_demo_a',
    DT_User: '2025-10-15T00:00:00Z',
  },
  {
    ID_Facturacao: 3,
    ID_Order: 1002,
    ID_Tp_Doc_FT: 'FT',
    N_Doc_FT: 'FT 2025/0003',
    DT_Doc_FT: '2025-09-20T00:00:00Z',
    Valor_Doc_FT: 66000,
    ID_User: 'u_demo_b',
    DT_User: '2025-09-20T00:00:00Z',
  },
  {
    ID_Facturacao: 4,
    ID_Order: 1002,
    ID_Tp_Doc_FT: 'FT',
    N_Doc_FT: 'FT 2025/0004',
    DT_Doc_FT: '2025-09-25T00:00:00Z',
    Valor_Doc_FT: 66000,
    ID_User: 'u_demo_b',
    DT_User: '2025-09-25T00:00:00Z',
  },
  {
    ID_Facturacao: 5,
    ID_Order: 1002,
    // Nota Crédito — negative value reduces the net invoiced total.
    ID_Tp_Doc_FT: 'NC',
    N_Doc_FT: 'NC 2025/0001',
    DT_Doc_FT: '2025-10-01T00:00:00Z',
    Valor_Doc_FT: -3000,
    ID_User: 'u_demo_b',
    DT_User: '2025-10-01T00:00:00Z',
  },
]