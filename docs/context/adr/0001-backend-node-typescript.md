# ADR-0001: Backend framework — Node + TypeScript

## Status

Accepted

## Context

The OMP application started in a frontend/UI-first phase. The user
then required the Administration page to connect to SQL Server, list its
tables, and sync the orders table rather than simulate those operations.

Two hard constraints make this a backend task, not a frontend one:

1. A browser cannot speak MS SQL Server's TDS protocol or reach port 1433. "Actually connect, no simulation" is physically impossible from page JavaScript.
2. The project's own binding docs forbid DB credentials or connection concepts in the frontend:
   - `ARCHITECTURE.md §1` — the frontend must not depend directly on connection strings, SQL, or ODBC.
   - `ARCHITECTURE.md §10` — the frontend must never contain production database credentials.
   - `SECURITY.md §6` — frontend bundles must contain no secrets.
   - `INTEGRATION_PLAN.md §6 Step 1` — proving DB connectivity is a backend responsibility.

The documented roadmap (`ARCHITECTURE.md §1`, `INTEGRATION_PLAN.md`) places the backend in a later integration phase. The user's request to connect to the real database now pulls that work forward, ahead of the documented future phase. `ARCHITECTURE.md §12` requires an ADR for selecting a backend framework.

## Decision

Adopt **Node.js with TypeScript** as the backend framework for the `server/` directory in this repository, sibling to `app/`.

- **Stack:** Node.js + TypeScript + Express + the `mssql` package (node-mssql, which wraps tedious) for SQL Server connectivity.
- **Location:** `server/` in this repo. Own `package.json`, `tsconfig.json`, strict TypeScript, run via `tsx`.
- **Credentials — two paths, both backend-resolved:**
  - **Ad-hoc (development/integration):** the admin UI sends `{ server, port, database, user, password }` in the request body. Credentials are **ephemeral** — sent per request, never persisted, and the password is never logged. Ad-hoc connections are disabled unless the backend explicitly sets `ALLOW_AD_HOC_CONNECTIONS=true`.
  - **Backend-managed named profiles (production):** the backend holds connection secrets in its environment variables or a secret store (Azure Key Vault later). The frontend only selects a profile by name via `GET /api/admin/profiles`, which returns `{ id, name, networkMode }` and **no credentials**. This satisfies `SECURITY.md §6` for production: the frontend never holds production DB credentials.
- **Administration/API authentication:** non-loopback deployments require `ADMIN_API_TOKEN`; loopback development may be tokenless under the explicit boot guard. When used, the UI sends the token only in the `Authorization: Bearer` header and never persists it.
- **SQL Server TLS:** encrypted connections and certificate validation are enabled by default. Trusting a private/self-signed certificate for ad-hoc development requires the explicit `AD_HOC_TRUST_SERVER_CERTIFICATE=true` override.
- **SQL safety:** all user-supplied values are parameterized where SQL supports parameters (`limit` is bound as `TOP (@limit)`). Identifiers (schema/table names) cannot be parameterized, so the backend re-queries `INFORMATION_SCHEMA.TABLES` per connection and only proceeds if the requested `(schema, table)` is in that whitelist, then quotes with `[schema].[table]` after a `^[A-Za-z_][A-Za-z0-9_#$]{0,127}$` regex guard. No string concatenation of raw user input into SQL (per `SECURITY.md §5`).
- **Statelessness:** the backend opens a short-lived `mssql` pool per request, queries, closes it, and keeps no store. The password is never written to logs or error responses.

## Alternatives considered

- **ASP.NET Core (C#).** This is the documented likely direction for the production backend (`STACK.md §2`, `INTEGRATION_PLAN.md`). Deferred here because it is a larger lift — a second language/runtime/toolchain, C# onboarding cost, and separate build/deploy pipeline — and the immediate need is to prove real DB connectivity and surface the orders schema. The repository/service seam in the frontend is preserved so the backend remains replaceable; ASP.NET Core can replace this Node service later without rewriting the UI.
- **Vite dev middleware / in-browser connection.** Dev-only, no production path. A browser still cannot speak TDS or reach port 1433, so this cannot satisfy "actually connect" even in development. Rejected.

## Consequences

- **Fastest real and testable now.** The user can connect to the real database, list tables, and sync the orders table this slice, using the same language and repo as the frontend.
- **UI seam unchanged, backend replaceable.** The frontend talks to the backend over a small REST surface (`/api/admin/*`, `/api/orders/sync`). Swapping Node for ASP.NET Core later only requires implementing the same contract on the new backend; the UI is not rewritten.
- **Production secrets live in the backend, never the frontend.** For the profile path, credentials stay in backend env vars / a secret store. For the ad-hoc path, credentials are ephemeral per request. `SECURITY.md §6` is satisfied.
- **Deferred concerns to revisit before production cutover:**
  - **Identity-provider authorization.** This slice adds a timing-safe administrator Bearer token but does not yet integrate Entra ID or role claims. Replace the bootstrap token with the production identity provider before broader rollout.
  - **Production deployment topology.** `SECURITY.md §16` (Network exposure of SQL Server) governs reachability — LAN, private VPN/network, or approved cloud networking; never direct public exposure of port 1433 to the internet. Deployment configuration must enforce this.
  - **Audit logging** (`SECURITY.md §8`) for admin connect/sync actions.
- **One shared type kept in sync by hand.** `DatabaseConnectionProfile` is defined in `server/src/types.ts` and mirrored in `app/src/domain/models/database-connection-profile.ts`. Same repo, same language; a workspace shared-package is overkill for one type. Drift risk is low and caught by typecheck.

## References

- `docs/architecture/STACK.md §2` — documented backend direction (ASP.NET likely).
- `docs/security/SECURITY.md §5` — SQL safety (parameterized SQL, no string concatenation).
- `docs/security/SECURITY.md §6` — Secrets (frontend bundles contain no secrets).
- `docs/security/SECURITY.md §16` — Network exposure of SQL Server (new, added with this ADR).
- `docs/architecture/INTEGRATION_PLAN.md §4–6` — integration phases and backend responsibilities.
- `docs/architecture/ARCHITECTURE.md §1` — frontend must not depend on connection strings/SQL/ODBC.
- `docs/architecture/ARCHITECTURE.md §10` — frontend must never contain production database credentials.
- `docs/architecture/ARCHITECTURE.md §12` — an ADR is required for backend framework selection.
