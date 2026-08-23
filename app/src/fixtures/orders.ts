/**
 * Deterministic, synthetic order fixtures.
 *
 * MOCK DATA ONLY — never production facts (docs/context/MOCK_DATA_CONTRACT.md).
 * Names are obviously synthetic; identifiers are non-production.
 * Fixtures are deterministic: the same scenario always renders the same way.
 *
 * Named order scenarios (MOCK_DATA_CONTRACT §3 — Orders):
 * - 1001: normal open order
 * - 1002: closed deal
 * - 1003: factory order
 * - 1004: order without factory data
 * - 1005: high-value order
 * - 1006: order with all optional fields null
 */
import type { Order, OrderSummary } from '@/domain/models/order'

/**
 * Client display name keyed by `ID_Client`.
 *
 * `Client_Name` is NOT a field on `Order` — it is an unverified projection of
 * the legacy `V_Order_List` view (see `OrderSummary.Client_Name` doc comment).
 * We derive it here from a single synthetic source of truth so the mock
 * repository and `toOrderSummary` stay consistent. `null` IDs map to `null`.
 */
export const clientNameById: Readonly<Record<number, string>> = {
  501: 'Client Alpha',
  502: 'Client Beta',
  503: 'Test Dealer',
  504: 'Demo Hospital',
}

/** Resolve a client display name from an `ID_Client`, mirroring V_Order_List. */
export function resolveClientName(idClient: number | null): string | null {
  if (idClient === null) return null
  return clientNameById[idClient] ?? null
}

/**
 * Project a full `Order` to the list-row summary shape.
 * `Client_Name` is derived from `ID_Client` via `clientNameById` (unverified
 * V_Order_List projection — see `OrderSummary` model doc).
 */
export function toOrderSummary(order: Order): OrderSummary {
  return {
    ID_Order: order.ID_Order,
    DT_Order: order.DT_Order,
    Order_Factory: order.Order_Factory,
    ID_Tp_Order: order.ID_Tp_Order,
    ID_Client: order.ID_Client,
    Client_Name: resolveClientName(order.ID_Client),
    ID_Area: order.ID_Area,
    ID_Tipo: order.ID_Tipo,
    ID_Produto: order.ID_Produto,
    ID_Instrumento: order.ID_Instrumento,
    Sell_Price: order.Sell_Price,
    Negocio_Fechado: order.Negocio_Fechado,
    Encomenda_Cli_PHC: order.Encomenda_Cli_PHC,
  }
}

/**
 * Full Order fixtures (all §10 fields). IDs/dates/clients/prices match the
 * earlier summary scenarios; the additional Order-only fields are filled with
 * plausible synthetic values. Row 1006 keeps every optional field null.
 */
export const orders: readonly Order[] = [
  {
    ID_Order: 1001,
    DT_Order: '2025-09-12',
    Order_Factory: false,
    ID_Tp_Order: 'STD',
    Encomenda_Cli_PHC: 'PHC-1001',
    ID_Client: 501,
    ID_Area: 1,
    ID_Tipo: 2,
    ID_Produto: 10,
    ID_Instrumento: 200,
    Orc_Proposta: 47000,
    PO_Cliente: 'PO-ALPHA-001',
    Sell_Price: 48500,
    ID_Tp_Warranty: 'STD',
    Warranty_Reserve: 1455,
    Warranty_DT_Inicio: '2025-09-13',
    ID_Tp_Revenue: 'REV-STD',
    Facturado: false,
    Reconhecido: false,
    Cod_Enc_Fornecedor: 'SUP-1001',
    Obs: 'Synthetic demo order for Client Alpha.',
    Negocio_Fechado: false,
    ID_User: 'u_demo_a',
    DT_User: '2025-09-12T09:00:00Z',
    upsize_ts: null,
    Kit: false,
    Kit_Amount: null,
    Contacto: 'Alice Demo',
    Email: 'alice@demo-alpha.example',
  },
  {
    ID_Order: 1002,
    DT_Order: '2025-09-12',
    Order_Factory: true,
    ID_Tp_Order: 'FAB',
    Encomenda_Cli_PHC: 'PHC-1002',
    ID_Client: 502,
    ID_Area: 1,
    ID_Tipo: 2,
    ID_Produto: 11,
    ID_Instrumento: 201,
    Orc_Proposta: 128000,
    PO_Cliente: 'PO-BETA-002',
    Sell_Price: 132000,
    ID_Tp_Warranty: 'EXT',
    Warranty_Reserve: 6600,
    Warranty_DT_Inicio: '2025-09-13',
    ID_Tp_Revenue: 'REV-FAB',
    Facturado: true,
    Reconhecido: true,
    Cod_Enc_Fornecedor: 'SUP-1002',
    Obs: 'Synthetic closed-deal factory order for Client Beta.',
    Negocio_Fechado: true,
    ID_User: 'u_demo_b',
    DT_User: '2025-09-12T10:30:00Z',
    upsize_ts: null,
    Kit: true,
    Kit_Amount: 1500,
    Contacto: 'Bob Demo',
    Email: 'bob@demo-beta.example',
  },
  {
    ID_Order: 1003,
    DT_Order: '2025-08-30',
    Order_Factory: true,
    ID_Tp_Order: 'FAB',
    Encomenda_Cli_PHC: 'PHC-1003',
    ID_Client: 503,
    ID_Area: 2,
    ID_Tipo: 3,
    ID_Produto: 12,
    ID_Instrumento: 202,
    Orc_Proposta: 84000,
    PO_Cliente: 'PO-DEALER-003',
    Sell_Price: 87000,
    ID_Tp_Warranty: 'STD',
    Warranty_Reserve: 2610,
    Warranty_DT_Inicio: '2025-08-31',
    ID_Tp_Revenue: 'REV-FAB',
    Facturado: false,
    Reconhecido: false,
    Cod_Enc_Fornecedor: 'SUP-1003',
    Obs: 'Synthetic open factory order for Test Dealer.',
    Negocio_Fechado: false,
    ID_User: 'u_demo_c',
    DT_User: '2025-08-30T14:00:00Z',
    upsize_ts: null,
    Kit: false,
    Kit_Amount: null,
    Contacto: 'Carol Demo',
    Email: 'carol@demo-dealer.example',
  },
  {
    ID_Order: 1004,
    DT_Order: '2025-08-15',
    Order_Factory: false,
    ID_Tp_Order: 'STD',
    Encomenda_Cli_PHC: 'PHC-1004',
    ID_Client: 504,
    ID_Area: 2,
    ID_Tipo: 3,
    ID_Produto: 13,
    ID_Instrumento: null,
    Orc_Proposta: 38000,
    PO_Cliente: 'PO-HOSP-004',
    Sell_Price: 39500,
    ID_Tp_Warranty: null,
    Warranty_Reserve: null,
    Warranty_DT_Inicio: null,
    ID_Tp_Revenue: 'REV-STD',
    Facturado: false,
    Reconhecido: false,
    Cod_Enc_Fornecedor: 'SUP-1004',
    Obs: 'Synthetic order for Demo Hospital with no instrument assigned.',
    Negocio_Fechado: false,
    ID_User: 'u_demo_d',
    DT_User: '2025-08-15T11:15:00Z',
    upsize_ts: null,
    Kit: false,
    Kit_Amount: null,
    Contacto: 'Dave Demo',
    Email: 'dave@demo-hospital.example',
  },
  {
    ID_Order: 1005,
    DT_Order: '2025-07-22',
    Order_Factory: false,
    ID_Tp_Order: 'STD',
    Encomenda_Cli_PHC: 'PHC-1005',
    ID_Client: 501,
    ID_Area: 1,
    ID_Tipo: 2,
    ID_Produto: 10,
    ID_Instrumento: 203,
    Orc_Proposta: 725000,
    PO_Cliente: 'PO-ALPHA-005',
    Sell_Price: 750000,
    ID_Tp_Warranty: 'EXT',
    Warranty_Reserve: 37500,
    Warranty_DT_Inicio: '2025-07-23',
    ID_Tp_Revenue: 'REV-STD',
    Facturado: false,
    Reconhecido: false,
    Cod_Enc_Fornecedor: 'SUP-1005',
    Obs: 'Synthetic high-value order for Client Alpha.',
    Negocio_Fechado: false,
    ID_User: 'u_demo_a',
    DT_User: '2025-07-22T08:45:00Z',
    upsize_ts: null,
    Kit: true,
    Kit_Amount: 9750,
    Contacto: 'Alice Demo',
    Email: 'alice@demo-alpha.example',
  },
  {
    ID_Order: 1006,
    DT_Order: '2025-06-04',
    Order_Factory: null,
    ID_Tp_Order: null,
    Encomenda_Cli_PHC: null,
    ID_Client: null,
    ID_Area: null,
    ID_Tipo: null,
    ID_Produto: null,
    ID_Instrumento: null,
    Orc_Proposta: null,
    PO_Cliente: null,
    Sell_Price: null,
    ID_Tp_Warranty: null,
    Warranty_Reserve: null,
    Warranty_DT_Inicio: null,
    ID_Tp_Revenue: null,
    Facturado: null,
    Reconhecido: null,
    Cod_Enc_Fornecedor: null,
    Obs: null,
    Negocio_Fechado: null,
    ID_User: null,
    DT_User: null,
    upsize_ts: null,
    Kit: null,
    Kit_Amount: null,
    Contacto: null,
    Email: null,
  },
]

/**
 * Summary rows derived from `orders` via `toOrderSummary`.
 * Re-exported so existing importers of the summary shape keep working.
 */
export const orderSummaries: readonly OrderSummary[] = orders.map(toOrderSummary)