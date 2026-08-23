# TESTING.md

## Testing philosophy

Tests must provide repeatable evidence.

Do not treat:

```text
"I clicked it and it looked fine"
```

as sufficient verification.

During the current UI-first phase, tests prove frontend and confirmed business-rule behavior against deterministic mock scenarios.

During the future integration phase, additional tests must prove database/API/Access parity.

---

# 1. Current test layers

## 1.1 Pure logic tests

Use Vitest for:

- recognition calculations,
- permission helpers,
- filter normalization,
- date/range rules,
- formatting-independent business rules.

These tests must not require React.

Example:

```text
Sell Price = 100000
Warranty Reserve = 10000
Non-W Recognized = 50000

Expected:
Instrument Capacity = 90000
Instrument Backlog = 40000
```

---

## 1.2 Component tests

Use React Testing Library for:

- form behavior,
- filter controls,
- permission-driven UI,
- validation messages,
- empty/error/loading states,
- dialog behavior.

Test user-visible behavior rather than implementation internals.

Avoid asserting private component state.

---

## 1.3 Browser/E2E tests

Use Playwright against the real built frontend plus mock data/API layer.

Examples:

- navigate to Orders,
- filter by client,
- open order,
- switch role,
- verify read-only UI,
- navigate to recognition,
- verify calculated values,
- open admin section as admin,
- verify non-admin cannot access admin UX.

---

# 2. Visual regression

Major pages should have screenshot coverage.

Recommended states:

- Dashboard Admin
- Dashboard Viewer
- Orders List
- Orders Empty
- Order Detail
- Clients List
- Factory/Invoicing
- Recognition
- Stock
- Reports
- Administration

Suggested viewport baseline:

```text
Desktop 1440x900
Laptop 1280x800
Tablet 768x1024
Mobile 390x844
```

If the final product is desktop-first, mobile may be reduced in priority but must not catastrophically break.

---

# 3. Accessibility testing

Automate accessibility checks where possible.

Verify:

- form labels,
- button accessible names,
- keyboard navigation,
- dialog focus handling,
- table semantics,
- heading hierarchy,
- error announcements,
- contrast where automated tooling can detect it.

Use axe integration with Playwright or component tests where appropriate.

---

# 4. Deterministic fixtures

Tests must not depend on random generated data.

Use named scenarios.

Example:

```text
order_standard_open
order_closed
order_factory_pending
order_invoice_missing_pdf
order_historical_recognition
order_recognition_at_limit
order_recognition_over_limit
```

The same fixture must produce the same result on every machine.

---

# 5. Mock failure tests

Mock repositories must support controlled failures such as:

- delay,
- 404/not found,
- 401/unauthenticated,
- 403/forbidden,
- 500/server failure,
- empty result.

The UI must handle each state intentionally.

---

# 6. Permission matrix tests

At minimum:

| Action | Viewer | Editor | Admin |
|---|---:|---:|---:|
| View orders | Yes | Yes | Yes |
| Create/edit normal order UI | No | Yes | Yes |
| View clients | Yes | Yes | Yes |
| Create/edit client UI | No | Yes | Yes |
| Recognition mutation UI | No | Yes | Yes |
| Stock mutation UI | Define explicitly | Define explicitly | Yes |
| Admin maintenance UI | No | No | Yes |
| Close Deals UI | No | No | Yes |

Where legacy behavior is inconsistent, mark the expected web behavior as a deliberate decision.

---

# 7. Business-rule tests

Known rules from current Access evidence include:

## Recognition

```text
Non-W capacity =
Sell_Price - Warranty_Reserve
```

```text
Warranty capacity =
Warranty_Reserve
```

```text
Non-W recognition must not exceed non-W capacity
```

```text
W recognition must not exceed warranty capacity
```

Historical recognition behavior must also be represented in UI tests.

---

# 8. What current tests do not prove

Current mock-based tests do not prove:

- production query correctness,
- database constraints,
- actual row mapping,
- saved-query semantics,
- email delivery,
- production authentication,
- production authorization,
- database performance,
- real Access parity.

CI/test reports must not imply otherwise.

---

# 9. Future integration test layers

When the database/backend becomes available, add:

## Database contract tests

Verify required objects and fields exist.

## API integration tests

Verify real API operations against a controlled database environment.

## Access parity/characterization tests

For known Access input:

```text
same input
→ Access result
→ Web/API result
→ compare
```

## Report reconciliation

Compare report totals/rows for fixed periods and filters.

## Security authorization tests

Verify direct API calls return:

- 401 when unauthenticated,
- 403 when authenticated but unauthorized.

## Transaction tests

Verify failed writes do not leave partial database state.

---

# 10. Mutation testing

When business logic stabilizes, mutation testing is recommended.

Purpose:

- deliberately alter code,
- verify tests fail,
- measure whether tests detect real behavioral changes.

A passing test suite is stronger when it can kill meaningful mutations.

---

# 11. CI quality gates — current phase

A normal PR/commit should eventually require:

```text
TypeScript compile       PASS
Lint                     PASS
Unit tests               PASS
Component tests          PASS
Playwright critical flow PASS
Accessibility baseline   PASS
Visual diff              reviewed/pass
Production build         PASS
```

---

# 12. Test naming

Prefer behavior-oriented names.

Good:

```text
viewer_cannot_open_order_edit_mode
recognition_rejects_non_w_amount_above_capacity
orders_search_filters_client_by_contains_match
```

Bad:

```text
test1
order_test
button_works
```

---

# 13. Evidence rule

If a feature has no automated test, state clearly that the behavior is manually verified only.

Do not present untested behavior as proven.
