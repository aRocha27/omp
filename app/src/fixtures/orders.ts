/**
 * Deterministic, synthetic order fixtures.
 *
 * MOCK DATA ONLY — never production facts (docs/context/MOCK_DATA_CONTRACT.md).
 * Names are obviously synthetic; identifiers are non-production.
 * Fixtures are deterministic: the same scenario always renders the same way.
 */
import type { OrderSummary } from '@/domain/models/order'

/**
 * Named order scenarios (MOCK_DATA_CONTRACT §3 — Orders):
 * - normal open order
 * - closed deal
 * - factory order
 * - order without factory data
 * - high-value order
 * - order with null optional fields
 */
export const orderSummaries: readonly OrderSummary[] = [
  {
    ID_Order: 1001,
    DT_Order: '2025-09-12',
    Order_Factory: false,
    ID_Tp_Order: 'STD',
    ID_Client: 501,
    Client_Name: 'Client Alpha',
    ID_Area: 1,
    ID_Tipo: 2,
    ID_Produto: 10,
    ID_Instrumento: 200,
    Sell_Price: 48500,
    Negocio_Fechado: false,
    Encomenda_Cli_PHC: 'PHC-1001',
  },
  {
    ID_Order: 1002,
    DT_Order: '2025-09-12',
    Order_Factory: true,
    ID_Tp_Order: 'FAB',
    ID_Client: 502,
    Client_Name: 'Client Beta',
    ID_Area: 1,
    ID_Tipo: 2,
    ID_Produto: 11,
    ID_Instrumento: 201,
    Sell_Price: 132000,
    Negocio_Fechado: true,
    Encomenda_Cli_PHC: 'PHC-1002',
  },
  {
    ID_Order: 1003,
    DT_Order: '2025-08-30',
    Order_Factory: true,
    ID_Tp_Order: 'FAB',
    ID_Client: 503,
    Client_Name: 'Test Dealer',
    ID_Area: 2,
    ID_Tipo: 3,
    ID_Produto: 12,
    ID_Instrumento: 202,
    Sell_Price: 87000,
    Negocio_Fechado: false,
    Encomenda_Cli_PHC: 'PHC-1003',
  },
  {
    ID_Order: 1004,
    DT_Order: '2025-08-15',
    Order_Factory: false,
    ID_Tp_Order: 'STD',
    ID_Client: 504,
    Client_Name: 'Demo Hospital',
    ID_Area: 2,
    ID_Tipo: 3,
    ID_Produto: 13,
    ID_Instrumento: null,
    Sell_Price: 39500,
    Negocio_Fechado: false,
    Encomenda_Cli_PHC: 'PHC-1004',
  },
  {
    ID_Order: 1005,
    DT_Order: '2025-07-22',
    Order_Factory: false,
    ID_Tp_Order: 'STD',
    ID_Client: 501,
    Client_Name: 'Client Alpha',
    ID_Area: 1,
    ID_Tipo: 2,
    ID_Produto: 10,
    ID_Instrumento: 203,
    Sell_Price: 750000,
    Negocio_Fechado: false,
    Encomenda_Cli_PHC: 'PHC-1005',
  },
  {
    ID_Order: 1006,
    DT_Order: '2025-06-04',
    Order_Factory: null,
    ID_Tp_Order: null,
    ID_Client: null,
    Client_Name: null,
    ID_Area: null,
    ID_Tipo: null,
    ID_Produto: null,
    ID_Instrumento: null,
    Sell_Price: null,
    Negocio_Fechado: null,
    Encomenda_Cli_PHC: null,
  },
] as const