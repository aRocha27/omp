# ARCHITECTURE.md

## Architectural objective

Build a browser application that replaces the Microsoft Access frontend while preserving the existing business workflows and keeping the existing database as the future system of record.

The current implementation phase does not have access to the real database.

Therefore the architecture must support two data modes:

```text
Development mode
React UI → application services → mock repositories → deterministic fixtures
```

and later:

```text
Integrated mode
React UI → application services → HTTP repositories → backend API → existing database
```

The React application must not depend directly on database concepts such as connection strings, SQL, DAO, ODBC, Access QueryDefs, or Outlook COM.

---

# 1. Architectural layers

Recommended frontend structure:

```text
src/
├── app/
│   ├── router/
│   ├── providers/
│   └── configuration/
│
├── features/
│   ├── dashboard/
│   ├── orders/
│   ├── clients/
│   ├── factory/
│   ├── invoicing/
│   ├── recognition/
│   ├── stock/
│   ├── reports/
│   └── administration/
│
├── domain/
│   ├── models/
│   ├── rules/
│   └── permissions/
│
├── services/
│   ├── contracts/
│   ├── mock/
│   └── http/
│
├── components/
│   ├── ui/
│   └── layout/
│
├── fixtures/
│
└── test/
```

Exact folder names may change, but the separation of responsibilities must remain.

---

# 2. Domain layer

The domain layer contains:

- confirmed business models,
- calculated values,
- validation rules,
- permission concepts,
- workflow state.

It must not import React UI components.

Examples:

- `calculateInstrumentCapacity`
- `calculateRecognitionBacklog`
- `canEditOrder`
- order/filter types
- recognition types

Business calculations should be independently testable.

---

# 3. Service/repository contracts

UI code must depend on interfaces/contracts rather than direct mock data.

Example:

```ts
export interface OrdersRepository {
  search(filters: OrderSearchFilters): Promise<OrderSummary[]>;
  getById(id: number): Promise<OrderDetail>;
  create(input: CreateOrderInput): Promise<OrderDetail>;
  update(id: number, input: UpdateOrderInput): Promise<OrderDetail>;
}
```

Development implementation:

```text
MockOrdersRepository
```

Future implementation:

```text
HttpOrdersRepository
```

The UI should not need to know which implementation is active.

---

# 4. Mock boundary

Mock repositories may:

- simulate latency,
- return deterministic fixtures,
- simulate errors,
- simulate permission outcomes,
- simulate empty results.

Mock repositories must not:

- invent new business rules,
- become the source of database truth,
- expose arbitrary structure that will be hard to map later.

---

# 5. Routing model

Recommended route families:

```text
/
 /orders
 /orders/new
 /orders/:id
 /orders/:id/factory
 /orders/:id/invoices
 /orders/:id/recognition

 /clients
 /clients/new
 /clients/:id

 /invoices

 /stock
 /stock/movements

 /reports

 /admin
 /admin/areas
 /admin/types
 /admin/products
 /admin/instruments
 ...
```

Exact paths may change through an ADR.

---

# 6. State management

Use different tools for different types of state.

## Server-like state

Even while mocked, remote-style application data should behave like server state.

Use TanStack Query for:

- loading,
- cache,
- refetch,
- retry,
- mutation state,
- invalidation.

## Local UI state

Use React local state for:

- open dialogs,
- current tab,
- temporary UI selection,
- menu state.

Avoid a large global state store unless a real cross-cutting need appears.

---

# 7. Forms

Forms must separate:

- display model,
- validation schema,
- repository mutation.

A form should not perform database-like operations directly.

Recommended approach:

```text
React Hook Form
    ↓
Zod validation
    ↓
feature service/repository mutation
```

Unknown legacy requirements must be visibly marked in code/docs rather than guessed.

---

# 8. Authorization architecture

Current UI development may simulate:

- Viewer
- Editor
- Administrator
- Unregistered/No-edit user

Frontend role checks are UX behavior only.

Future server/API authorization is mandatory.

Never treat:

```ts
if (role === "admin") { showButton(); }
```

as actual security.

---

# 9. Error architecture

Every data-driven feature must support:

- loading,
- successful load,
- empty state,
- validation error,
- not found,
- unauthorized/forbidden,
- recoverable server failure,
- unexpected failure.

The UI should never assume a request succeeds instantly.

---

# 10. Future backend boundary

The backend is responsible for:

- authentication validation,
- authorization,
- database access,
- SQL/query execution,
- transactions,
- input validation,
- sensitive business operations,
- email delivery,
- audit logging,
- report generation where appropriate.

The frontend must never contain production database credentials.

---

# 11. Existing database principle

The backend adapts to the existing database.

The frontend should not be designed around imagined database normalization.

If the existing database uses awkward names or legacy views, map those to clean application DTOs at the backend boundary.

---

# 12. Architectural change control

Any major deviation from this architecture should be recorded in `adr/`.

Examples:

- replacing Vite,
- adding Redux,
- selecting a backend framework,
- changing authentication provider,
- moving authorization away from `Utilizador`,
- changing report-generation strategy.

Do not make architectural changes silently.
