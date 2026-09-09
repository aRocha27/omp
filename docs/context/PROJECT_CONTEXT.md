# PROJECT_CONTEXT.md

## Purpose

This file is the short, mandatory project context for humans and coding agents.

Read this file before implementing or changing anything.

---

## Project goal

Convert the existing Microsoft Access Orders application into a modern browser-based business application.

The current phase is **modular web implementation with an integration backend**.

The Node/Express backend can connect to SQL Server through configured profiles
or explicitly enabled development ad-hoc connections. Real database parity and
production readiness are still pending verification.

---

## Current non-negotiable constraints

1. **Do not create or redesign the production database.**
2. **Do not assume access to the production database during development.**
3. **Do not invent missing Access behavior.**
4. **Use the Access source files as the primary behavioral reference.**
5. **Use deterministic mock data for UI development.**
6. **Keep the frontend isolated from database implementation through service/repository interfaces.**
7. **Do not claim database parity, production security, or end-to-end correctness before integration testing exists.**
8. **The current objective is a high-quality, testable, production-capable frontend architecture.**
9. **Security-sensitive behavior must be enforced in the backend and represented in the UI.**
10. **Every feature must use the repository/API boundary and remain compatible with real-database integration.**
11. **SQL Server must not be publicly exposed; it is reachable only via LAN, private VPN/network, or approved cloud networking — see SECURITY.md §16.**
12. **The backend is implemented, but production authentication, database parity and email/report integration are not yet proven.**

---

## Source hierarchy

When information conflicts, use this precedence:

1. Actual production database metadata, when eventually available
2. Raw Access exports and VBA
3. Full Access `SaveAsText` exports / saved-query SQL if later supplied
4. Access relationship PDF
5. `report.md`
6. `docs/CURRENT_STATUS.md`
7. draw.io diagrams
8. HTML/UI prototypes
9. Mock fixtures

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
    Mock or HTTP repositories/services
    ↓
React UI
    ↓
Logic + component + browser tests
```

Production/integration verification:

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

Current tests can objectively prove:

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

Until real integration verification is complete, do not claim:

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
9. `docs/CURRENT_STATUS.md`
10. Relevant sections of `report.md`

For data-driven features also read:

- `MOCK_DATA_CONTRACT.md`
- `INTEGRATION_PLAN.md`

For UI work also read:

- `UI_UX_GUIDELINES.md`

---

## Core principle

**Build the frontend so that replacing mock repositories with real API repositories later does not require redesigning the application.**
