# Current Status

## Repository

- Branch: `feature/refactor-modular-architecture`
- Frontend: `app/`
- Backend: `server/`
- Original Access/web project: sibling repository `../OMP`
- The original project is not modified by this refactor.

## Implemented

- React 19 + TypeScript frontend built with Vite.
- Express + TypeScript backend using `mssql` for SQL Server.
- Repository contracts with mock and HTTP implementations.
- Orders, clients, dashboard, invoicing, recognition, kit consumables and administration flows.
- Responsive shell, mobile navigation and horizontal scrolling for dense tables/charts.
- Role-aware viewer, editor and administrator UI states.
- Backend validation, parameterized SQL and server-side mutation checks.
- Modular server repositories under `server/src/repositories/`.
- Order detail split into focused components, including Notes, Logs, recognitions, invoices and kit consumables.
- Destructive delete confirmation dialogs for recognitions, invoices and kit consumables.
- XLSX export and deterministic mock fixtures.
- SQL migration `server/sql/001_order_audit_trail.sql` for the requested audit trail.

## Data modes

The frontend selects its repository implementation through `VITE_DATA_MODE`:

```text
mock  -> deterministic fixtures
api   -> HTTP API on the Node backend
```

Tests always use deterministic mock repositories.

The backend supports:

- backend-managed connection profiles;
- development ad-hoc connections when explicitly enabled;
- tokenless loopback development only;
- bearer-token protection for non-loopback administration/API deployment.

See `server/.env.example` and `app/.env.example` for configuration names.

## Verification status

Passing checks:

- app typecheck;
- app ESLint;
- app production build;
- server TypeScript build;
- whitespace/error checks.
- `omp-docker.zip` integrity check (`unzip -t`).

Known test-suite issues:

- some app tests still assert old reference fixtures and old order-policy behavior;
- one server SQL test rejects the valid nested `TOP 1` used by `OUTER APPLY`.

These failures must be corrected before treating the full test suite as green.

## Not yet proven

The following require real database access and controlled integration testing:

- exact SQL/view parity with Access;
- production database schema and nullability compatibility;
- production identity provider and per-user authorization;
- real invoice email delivery;
- Windows installer installation and Scheduled Task startup on a clean machine;
- report output reconciliation;
- production deployment, performance and rollback readiness.

## Distribution artifacts

- Docker distribution archives are generated under `docker/exports/` and excluded from Git.

`report.md` remains the historical evidence report for the supplied Access exports. It is not a status report.
