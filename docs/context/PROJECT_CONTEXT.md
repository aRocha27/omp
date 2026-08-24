# PROJECT_CONTEXT.md

## Purpose

This file is the short, mandatory project context for humans and coding agents.

Read this file before implementing or changing anything.

---

## Project goal

Convert the existing Microsoft Access Orders application into a modern browser-based business application.

The current phase is **frontend/UI-first development**.

The existing production database is outside the development environment and is **not available during normal implementation**.

The database will be integrated later, during MVP/integration work.

---

## Current non-negotiable constraints

1. **Do not create or redesign the production database.**
2. **Do not assume access to the production database during development.**
3. **Do not invent missing Access behavior.**
4. **Use the Access source files as the primary behavioral reference.**
5. **Use deterministic mock data for UI development.**
6. **Keep the frontend isolated from the future database implementation through service/repository interfaces.**
7. **Do not claim database parity, production security, or end-to-end correctness before integration testing exists.**
8. **The current objective is a high-quality, testable, production-capable frontend architecture.**
9. **Security-sensitive behavior must be designed now even if enforcement is completed later in the backend.**
10. **Every feature must be implemented with future real-database integration in mind.**
11. **SQL Server must not be publicly exposed; it is reachable only via LAN, private VPN/network, or approved cloud networking — see SECURITY.md §16.**

---

## Source hierarchy

When information conflicts, use this precedence:

1. Actual production database metadata, when eventually available
2. Raw Access exports and VBA
3. Full Access `SaveAsText` exports / saved-query SQL if later supplied
4. Access relationship PDF
5. `report.md`
6. draw.io diagrams
7. HTML/UI prototypes
8. Mock fixtures

Mock data is never a source of business truth.

---

## Current known artifacts

Typical workspace files include:

- `AGENT.md`
- `report.md`
- `orders_platform_mvp.html`
- `orders_database_context.drawio`
- Access `.cls` files
- Access relationship PDF / renders
- this documentation set

---

## Current development mode

```text
Access source
    ↓
Confirmed workflows and fields
    ↓
TypeScript contracts
    ↓
Mock repositories/services
    ↓
React UI
    ↓
Logic + component + browser tests
```

Later:

```text
Existing production database
    ↓
Backend/API
    ↓
Real repository implementation
    ↓
Frontend remains largely unchanged
    ↓
Integration + parity + security tests
```

---

## What can be proven now

During the UI-first phase, tests can objectively prove:

- the frontend compiles,
- routes work,
- deterministic mock scenarios render correctly,
- confirmed calculations produce expected results,
- permission presentation behaves as designed,
- loading/empty/error states work,
- responsive layouts do not regress,
- accessibility checks pass,
- browser workflows work against the mock data layer.

---

## What cannot be claimed yet

Until the real backend/database phase, do not claim:

- production database compatibility,
- exact Access query parity,
- production report parity,
- actual foreign-key behavior,
- production authentication correctness,
- server-side authorization correctness,
- real email delivery correctness,
- production performance,
- production security verification.

---

## Mandatory reading order before implementation

1. `PROJECT_CONTEXT.md`
2. `AGENT.md`
3. `ARCHITECTURE.md`
4. `STACK.md`
5. `MVP_SCOPE.md`
6. `SECURITY.md`
7. `TESTING.md`
8. `DEFINITION_OF_DONE.md`
9. Relevant sections of `report.md`

For data-driven features also read:

- `MOCK_DATA_CONTRACT.md`
- `INTEGRATION_PLAN.md`

For UI work also read:

- `UI_UX_GUIDELINES.md`

---

## Core principle

**Build the frontend so that replacing mock repositories with real API repositories later does not require redesigning the application.**
