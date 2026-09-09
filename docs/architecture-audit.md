# Architecture Audit

## Scope

This audit describes the current refactor repository. The original project at
`../OMP` remains the behavioral reference and is not modified here.

## Result

The planned modular refactor is implemented at the main structural boundaries:

```text
React features
    -> repository contracts
        -> mock repositories or HTTP repositories
            -> Express API
                -> SQL Server repositories
```

Frontend code does not access SQL or database credentials directly. The backend
owns connection handling, validation, authorization checks, SQL parameter
binding and database mapping.

## Current structure

### Frontend

- `app/src/app/`: router, providers and configuration.
- `app/src/features/`: dashboard, orders, clients, invoicing, recognition and administration.
- `app/src/domain/`: models, permissions, order policy and business rules.
- `app/src/services/contracts/`: repository interfaces used by features.
- `app/src/services/mock/`: deterministic fixture-backed repositories.
- `app/src/services/http/`: API-backed repositories.
- `app/src/components/`: shared layout and UI primitives.

The order detail feature is decomposed into focused components for editing,
recognitions, invoicing documents, kit consumables, notes and shared UI.

### Backend

- `server/src/routes/`: HTTP endpoints and request handling.
- `server/src/repositories/`: database access grouped by domain.
- `server/src/validation/`: Zod request schemas.
- `server/src/types/`: API and database-facing types.
- `server/src/auth.ts`: deployment authentication guard.
- `server/src/errors.ts` and route error helpers: stable API error mapping.

`server/src/db.ts` remains a compatibility facade for existing imports; new
database logic belongs in `server/src/repositories/`.

## Implemented responsibilities

- orders list, facets, detail, create and update;
- clients list, detail, create and update;
- dashboard KPIs, trend and operational queues;
- invoicing document CRUD and invoice snapshots;
- recognition CRUD, capacity validation and propagation;
- kit consumable CRUD and capacity validation;
- administration/master-data operations;
- mock-to-API repository selection;
- role-aware UI and server-side mutation authorization;
- parameterized SQL and input validation;
- audit-trail migration and local UI Logs for order-detail changes.

## Known intentional boundaries

- Mock mode is deterministic and is not production data.
- `report.md` documents Access evidence; it does not describe the current web implementation.
- The UI Logs panel is local session state and is not the server audit log.
- The SQL audit migration exists, but production deployment of that migration is
  still an operational/database task.

## Remaining integration work

The following are not claimed as complete until verified against the real
database and approved production environment:

- database object/schema contract verification;
- Access-to-web result reconciliation for lists, recognition, invoices and reports;
- production authentication and per-user authorization;
- real email delivery and attachment security;
- report generation parity;
- deployment hardening, monitoring, backup and rollback procedures.

See `docs/CURRENT_STATUS.md`, `docs/architecture/ARCHITECTURE.md`,
`docs/architecture/INTEGRATION_PLAN.md` and `docs/security/SECURITY.md` for
the authoritative current constraints.
