# MOCK_DATA_CONTRACT.md

## Purpose

Mock data exists to make frontend development deterministic before the real database/API is available.

Mock data is a development tool, not a business-data specification.

---

# 1. Mock data must be synthetic

Never copy real customer, invoice, employee, or order information into committed fixtures unless explicitly approved and sanitized.

Use clearly synthetic names such as:

- Client Alpha
- Client Beta
- Test Dealer
- Demo Hospital

Use obviously non-production identifiers.

---

# 2. Mock data must be deterministic

Do not generate core fixtures randomly.

Good:

```text
Order 1001 always represents normal open order.
Order 1002 always represents closed deal.
Order 1003 always represents factory/shipment scenario.
```

Bad:

```text
generate 100 random orders on every test run
```

Randomized data may be used only in dedicated property-based tests with reproducible seeds.

---

# 3. Required scenario catalog

Maintain named fixtures for at least:

## Orders

- normal open order
- closed deal
- factory order
- order without factory data
- high-value order
- order with null optional fields

## Recognition

- no recognition
- partial non-W recognition
- partial W recognition
- at exact capacity
- attempted over-capacity
- historical recognition
- future recognition

## Invoices

- eligible for email
- already marked sent
- blocked
- missing PDF
- missing/invalid email presentation state

## Stock

- in stock
- zero available
- reserved quantity
- multiple warehouses

## Users

- Viewer
- Editor
- Admin
- Unregistered/no-edit

---

# 4. Known-vs-assumed fields

If a field name exists in the Access evidence, it may be represented in mock types.

If SQL type/nullability is unknown:

- do not invent certainty,
- document assumptions,
- choose a development-friendly representation that is easy to remap later.

Example:

```ts
/**
 * Confirmed field name from Access export.
 * Actual DB nullability/type not yet verified.
 */
Sell_Price: number | null;
```

---

# 5. Mock repository behavior

Repositories should support configurable behavior:

```text
success
empty
delay
not-found
forbidden
server-error
```

Use deterministic controls or test handlers.

Do not scatter `setTimeout` and fake errors across UI components.

---

# 6. Business rules

Mocks may exercise confirmed business rules.

Mocks must not define new rules merely for convenience.

If an unknown rule is needed to proceed:

- isolate it,
- mark it as provisional,
- document it.

---

# 7. Mock KPI rule

Dashboard KPIs during UI development are synthetic.

They must be labelled/documented as presentation values.

No test may treat mock KPI totals as evidence about production.

---

# 8. Fixture ownership

Place fixtures in a dedicated location.

Example:

```text
src/fixtures/
  users.ts
  clients.ts
  orders.ts
  recognition.ts
  invoices.ts
  stock.ts
```

Tests may import fixtures or use repository test builders.

Avoid inline giant fixture objects inside components.

---

# 9. Future migration rule

When the API becomes available:

- do not delete all fixtures,
- retain them for deterministic frontend tests,
- add HTTP repositories alongside mock repositories,
- use configuration to select the data source.

Mock mode remains useful after production integration.
