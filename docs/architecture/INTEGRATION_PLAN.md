# INTEGRATION_PLAN.md

## Purpose

Define how the frontend and current Node backend connect to the existing
production database without requiring a frontend rewrite.

---

# 1. Current state

```text
React UI
    ↓
Repository contracts
    ├── Mock repositories → synthetic fixtures
    └── HTTP repositories → Node/Express API → SQL Server repositories → existing database
```

---

# 2. Future state

```text
React UI
    ↓
Same repository contracts
    ↓
HTTP repositories
    ↓
Backend/API
    ↓
Existing database
```

The frontend feature components already use repository contracts. Tests use
mock repositories; API mode uses the Node backend. Remaining work is real
database verification, not a frontend architecture rewrite.

---

# 3. Integration prerequisites

Before real integration, obtain factual information about:

- database engine,
- connection method,
- actual tables/views,
- actual saved-query locations,
- SQL definitions,
- field types,
- nullability,
- keys,
- indexes,
- permissions,
- existing stored procedures/functions.

Do not guess these from names.

---

# 4. Backend responsibilities

The backend should:

- authenticate users,
- authorize actions,
- query existing database objects,
- perform parameterized writes,
- manage transactions,
- expose stable DTOs,
- implement sensitive workflows,
- generate/serve reports where appropriate,
- send emails through an approved service,
- write audit information.

---

# 5. Mapping approach

Do not expose raw database rows directly when avoidable.

Use:

```text
Database row/view
    ↓
Backend mapping
    ↓
API DTO
    ↓
Frontend domain model
```

This isolates the UI from legacy schema quirks.

---

# 6. Integration sequence

Recommended sequence:

## Step 1 — Read-only connectivity

Prove backend can connect to the real database.

## Step 2 — Orders read path

Map `V_Order_List` or its actual equivalent.

Verify filters/order.

## Step 3 — Clients read path

Verify client list behavior.

## Step 4 — Order detail

Resolve actual `Order` form/data dependencies.

## Step 5 — Recognition read calculations

Compare values with Access.

## Step 6 — Controlled writes

Introduce write paths in a test/UAT environment.

## Step 7 — Invoicing/email

Implement server-side send behavior.

## Step 8 — Reports

Reconcile output against Access.

## Step 9 — Close Deals

Only after exact legacy query behavior is known.

---

# 7. Feature flags/data mode

Keep a development switch such as:

```text
DATA_MODE=mock
DATA_MODE=api
```

Mock and API modes should implement the same repository contracts.

---

# 8. Parity verification

For each migrated workflow capture:

```text
Known input
→ Access result
→ New API result
→ compare
```

Examples:

- order search IDs,
- client search IDs,
- recognition totals,
- backlog totals,
- report aggregates.

Do not retire Access based solely on UI similarity.

---

# 9. Integration errors

Plan for:

- missing database object,
- changed column,
- unexpected null,
- query timeout,
- permission denied,
- stale concurrent update,
- email attachment unavailable.

The API should convert backend-specific errors into stable application errors.

---

# 10. Production cutover

Production cutover should require:

- approved UAT,
- authorization verification,
- report reconciliation,
- backup/rollback plan,
- logging/monitoring,
- operational support plan.

Frontend completion alone is not a production cutover criterion.
