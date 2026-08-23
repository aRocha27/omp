# MVP_SCOPE.md

## Current phase

The current development target is **UI-first MVP preparation** without the production database.

The immediate objective is to build a maintainable frontend that accurately represents confirmed workflows and is ready for later API/database integration.

---

# 1. In scope now

## Application shell

- navigation/sidebar
- responsive layout
- page headers
- route structure
- role simulator
- reusable design-system components

## Dashboard

- module navigation
- mock KPIs
- recent activity
- recent orders
- clear indication that KPI values are synthetic during development

## Orders

- order list
- confirmed filters
- sorting behavior
- empty/loading/error states
- order detail
- create/edit UI
- read-only mode
- factory/invoice/recognition navigation

## Clients

- client list
- confirmed filters
- client detail
- create/edit UI
- read-only mode

## Factory / Invoicing

- factory status UI
- invoice list/queue UI
- missing attachment state
- email action confirmation UI
- mark-sent UX
- no real email delivery

## Revenue Recognition

- recognized totals
- warranty/non-warranty separation
- backlog display
- confirmed limit calculations
- over-limit validation
- historical-record presentation

## Stock

- search UI
- reference/description/warehouse filters
- movement screens/prototypes
- warehouse/material admin screens
- permission-state UX

## Reports

- report launcher
- confirmed report families
- filter UX
- preview placeholder
- export action UX
- no claim of real report parity

## Administration

- master-data navigation
- admin-only UX
- Close Deals confirmation UI only

---

# 2. Explicitly out of scope now

- production database connection
- production API
- production authentication
- production server authorization
- real Access query execution
- real Close Deals execution
- real invoice email delivery
- production report SQL
- real Excel reconciliation
- database migrations
- schema redesign
- production deployment hardening
- production performance testing

---

# 3. Mock-data rule

Every displayed business record/value must be clearly synthetic in development.

Mock records may emulate:

- order states,
- client types,
- factory states,
- invoice states,
- recognition calculations,
- stock states,
- permission states.

Mock data must not be presented as production facts.

---

# 4. MVP success criteria for current phase

The UI-first MVP is successful when:

1. All major confirmed modules have navigable screens.
2. Major workflows are represented end-to-end with mock repositories.
3. Viewer/Editor/Admin UI states are supported.
4. Confirmed recognition rules are implemented and tested.
5. Core lists have loading/empty/error states.
6. Pages are responsive enough for expected business use.
7. Accessibility baseline passes.
8. Playwright covers critical navigation/workflows.
9. Mock repositories can later be replaced by HTTP repositories.
10. No production database assumptions are embedded in UI components.

---

# 5. Deferred MVP integration phase

When database/API access becomes possible:

1. implement backend,
2. inventory actual DB objects,
3. create API DTO mappings,
4. implement HTTP repositories,
5. replace mock mode through configuration,
6. add database contract tests,
7. add integration tests,
8. compare Access output and new app output,
9. validate permissions and security,
10. run user acceptance testing.

---

# 6. Feature priority

Recommended order:

1. application shell/design system
2. Orders
3. Clients
4. Recognition
5. Factory/Invoicing
6. Stock
7. Reports
8. Administration
9. integration hardening

Orders should remain the central workflow because multiple legacy modules navigate back to an `Order`.
