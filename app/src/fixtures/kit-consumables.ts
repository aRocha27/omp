/**
 * Deterministic, synthetic Kit_Consumables fixtures.
 *
 * MOCK DATA ONLY — never production facts (docs/context/MOCK_DATA_CONTRACT.md).
 * Identifiers are non-production; dates are ISO 8601 UTC strings (TIMEZONE.md).
 *
 * Keyed to the mock Kit orders in `fixtures/orders.ts`:
 * - 1005 (Kit_Amount 9 750): two consumables (250 + 1 000 = 1 250) so the Kit
 *   tab's Saldo = 9 750 − 1 250 = 8 500 is demonstrable and positive.
 * - 1002 (Kit_Amount 1 500): one consumable (500) so Saldo = 1 000.
 */
import type { KitConsumable } from '@/domain/models/kit-consumable'

export const kitConsumables: readonly KitConsumable[] = [
  {
    ID_Kit: 1,
    ID_Order: 1005,
    Date: '2025-08-01T10:00:00Z',
    Internal_Order: 'INT-1005-A',
    Material: 'MAT-FILTER',
    Description: 'Filter cartridge replacement',
    Quant: 5,
    Unit_Price: 50,
    Total_Price: 250,
  },
  {
    ID_Kit: 2,
    ID_Order: 1005,
    Date: '2025-09-01T10:00:00Z',
    Internal_Order: 'INT-1005-B',
    Material: 'MAT-COLUMN',
    Description: 'Chromatography column',
    Quant: 2,
    Unit_Price: 500,
    Total_Price: 1000,
  },
  {
    ID_Kit: 3,
    ID_Order: 1002,
    Date: '2025-09-15T10:00:00Z',
    Internal_Order: 'INT-1002-A',
    Material: 'MAT-SEAL',
    Description: 'Service seal kit',
    Quant: 1,
    Unit_Price: 500,
    Total_Price: 500,
  },
]